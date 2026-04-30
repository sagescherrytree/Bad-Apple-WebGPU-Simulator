struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

struct SmokeParams {
    colour: vec4<f32>,
    size: f32,
    jfaColour: f32,
    _pad0: f32,
    _pad1: f32,
};

struct TrailShapeParams {
    length: f32,
    width: f32,
    useTrailShape: f32,
    _pad0: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> smokeParams: SmokeParams;
@group(0) @binding(4) var<uniform> trailShapeParams: TrailShapeParams;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) particleUv: vec2<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertIndex: u32) -> VSOut {
    let particleIndex = vertIndex / 6u;
    let cornerIndex   = vertIndex % 6u;

    let particle = particles[particleIndex];

    let size = smokeParams.size;
    let speed = length(particle.vel);
    let dir = select(
        vec2<f32>(1.0, 0.0),
        normalize(vec2<f32>(particle.vel.x, -particle.vel.y)),
        speed > 0.00001
    );
    let perp = vec2<f32>(-dir.y, dir.x);

    let halfLength = select(size, trailShapeParams.length, trailShapeParams.useTrailShape > 0.5);
    let halfWidth = select(size, trailShapeParams.width, trailShapeParams.useTrailShape > 0.5);

    var corners = array<vec2<f32>, 6>(
        -dir * halfLength - perp * halfWidth,
         dir * halfLength - perp * halfWidth,
        -dir * halfLength + perp * halfWidth,

        -dir * halfLength + perp * halfWidth,
         dir * halfLength - perp * halfWidth,
         dir * halfLength + perp * halfWidth,
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

    out.particleUv = particle.pos;

    return out;
}
