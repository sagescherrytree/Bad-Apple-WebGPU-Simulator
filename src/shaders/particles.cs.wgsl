struct Particle {
    pos : vec2<f32>,
    vel : vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var velocityTex : texture_2d<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let index = id.x;
    if (index >= arrayLength(&particles)) { return; }

    var p = particles[index];

    // Sample velocity from velocityTex
    let uv = p.pos;
    let texSize = vec2<f32>(textureDimensions(velocityTex));
    let velSample = textureLoad(
        velocityTex,
        vec2<i32>(uv * texSize),
        0
    ).xy;

    // Integrate position
    p.pos += velSample * 0.01; // dt can be parameterized
    particles[index] = p;
}