struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

struct SmokeParams {
    colour: vec4<f32>,
    size: f32,
    randomColour: f32,
    _pad0: f32,
    _pad1: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> smokeParams: SmokeParams;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertIndex: u32) -> VSOut {
    let particleIndex = vertIndex / 6u;
    let cornerIndex   = vertIndex % 6u;

    let particle = particles[particleIndex];

    let size = smokeParams.size;

    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-size, -size),
        vec2<f32>( size, -size),
        vec2<f32>(-size,  size),

        vec2<f32>(-size,  size),
        vec2<f32>( size, -size),
        vec2<f32>( size,  size),
    );

    var uvs = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(0.0, 1.0),

        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0),
    );

    let ndc = vec2<f32>(
        particle.pos.x * 2.0 - 1.0,
        (1.0 - particle.pos.y) * 2.0 - 1.0
    );

    var out: VSOut;
    out.pos = vec4<f32>(ndc + corners[cornerIndex], 0.0, 1.0);
    out.uv  = uvs[cornerIndex];

    return out;
}
