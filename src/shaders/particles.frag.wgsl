struct ParticleParams {
    velocityScale: f32,
    colour: vec3<f32>,
};

@group(0) @binding(1) var<uniform> particleParams : ParticleParams;

@fragment
fn main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(particleParams.colour, color.a);
}