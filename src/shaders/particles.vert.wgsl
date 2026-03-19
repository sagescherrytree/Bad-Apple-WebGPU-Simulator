struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) color: vec4<f32>,
};

// 6 vertices per particle (2 triangles = 1 quad)
@vertex
fn main(@builtin(vertex_index) vertIndex: u32) -> VSOut {
    let particleIndex = vertIndex / 6u;
    let cornerIndex   = vertIndex % 6u;

    let particle = particles[particleIndex];

    // Quad corners in NDC offset — controls particle size
    let size = 0.006; // tweak this for larger/smaller particles
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-size, -size),
        vec2<f32>( size, -size),
        vec2<f32>(-size,  size),
        vec2<f32>(-size,  size),
        vec2<f32>( size, -size),
        vec2<f32>( size,  size),
    );

    let ndc = particle.pos * 2.0 - vec2<f32>(1.0, 1.0);

    var out: VSOut;
    out.pos   = vec4<f32>(ndc + corners[cornerIndex], 0.0, 1.0);
    out.color = vec4<f32>(1.0, 0.9, 0.8, 1.0); // warm white
    return out;
}