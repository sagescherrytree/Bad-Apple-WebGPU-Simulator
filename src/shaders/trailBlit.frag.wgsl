struct BlitParams {
    intensity: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var trailTex     : texture_2d<f32>;
@group(0) @binding(1) var trailSampler : sampler;
@group(0) @binding(2) var<uniform> blitParams : BlitParams;

@fragment
fn main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    let colour = textureSample(trailTex, trailSampler, uv);
    return vec4<f32>(colour.rgb * blitParams.intensity, colour.a);
}