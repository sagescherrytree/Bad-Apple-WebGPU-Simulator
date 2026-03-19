struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var velocityTex: texture_2d<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= arrayLength(&particles)) { return; }

    var p = particles[id.x];
    var uv = p.pos;

    let texSizeI = vec2<i32>(textureDimensions(velocityTex));
    let pixel = clamp(vec2<i32>(uv * vec2<f32>(texSizeI)), vec2<i32>(0), texSizeI - vec2<i32>(1));

    // Sample velocity — flip Y to match NDC convention
    var velocity = textureLoad(velocityTex, pixel, 0).xy;
    velocity.y = -velocity.y;

    let velocityScale = 0.002;
    uv += velocity * velocityScale;

    uv = fract(uv); // wrap at edges instead of piling up at corners

    particles[id.x].pos = uv;
}