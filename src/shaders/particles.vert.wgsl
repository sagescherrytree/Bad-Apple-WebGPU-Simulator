struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn main(@builtin(vertex_index) index: u32) -> VSOut {
    let particle = particles[index];
    // convert pos [0,1] -> NDC [-1,1]
    let ndc = particle.pos * 2.0 - vec2<f32>(1.0, 1.0);

    var out: VSOut;
    out.pos = vec4<f32>(ndc, 0.0, 1.0);
    out.color = vec4<f32>(1.0, 0.5, 0.0, 1.0); // orange color
    return out;
}