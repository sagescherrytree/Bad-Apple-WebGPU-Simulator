struct ParticleParams {
    velocityScale: f32,
    renderMode: f32,
    densityPower: f32,
    alphaScale: f32,
    colour: vec3<f32>,
};

@group(0) @binding(1) var<uniform> particleParams : ParticleParams;

@fragment
fn main(@location(0) color: vec4<f32>, @location(1) uv: vec2<f32>) -> @location(0) vec4<f32>{
    // Blob SDF logic.
    let p = uv * 2.0 - 1.0;
    let r = length(p);

    let density = smoothstep(1.0, 0.0, r);

    let defaultOutput = vec4<f32>(particleParams.colour, color.a);
    let blobOutput = vec4<f32>(
        particleParams.colour * density,
        density * particleParams.alphaScale
    );

    return select(defaultOutput, blobOutput, particleParams.renderMode > 0.5);
}