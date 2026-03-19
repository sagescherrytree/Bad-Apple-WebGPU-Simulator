@group(0) @binding(0) var<storage, read_write> particles: array<vec4<f32>>; // xy: pos, zw: unused
@group(0) @binding(1) var velocityTex: texture_2d<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= arrayLength(&particles)) { return; }

    var p = particles[id.x];
    var uv = p.xy;

    // Get velocity from the velocity grid
    let texSizeI = vec2<i32>(textureDimensions(velocityTex));
    let pixel = clamp(vec2<i32>(uv * vec2<f32>(texSizeI)), vec2<i32>(0), texSizeI - vec2<i32>(1));
    let velocity = textureLoad(velocityTex, pixel, 0).xy;

    // Euler integration with scaling
    let dt = 1.0;             // you can pass real delta later if needed
    let velocityScale = 0.05; // tweak for visual effect
    uv += velocity * dt * velocityScale;

    // Clamp to stay in 0→1 range
    uv = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

    // Write back updated position, keep original zw
    particles[id.x] = vec4<f32>(uv, p.z, p.w);
}