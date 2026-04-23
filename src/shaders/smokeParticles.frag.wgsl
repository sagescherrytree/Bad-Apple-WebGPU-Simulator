struct SmokeParams {
    colour: vec4<f32>,
    size: f32,
    randomColour: f32,
    _pad0: f32,
    _pad1: f32,
};

@group(0) @binding(1) var<uniform> smokeParams: SmokeParams;

@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let center = vec2<f32>(0.5, 0.5);
    let d = distance(uv, center);
    let alpha = exp(-d * d * 12.0);
    let smokeColor = smokeParams.colour.rgb;
    return vec4<f32>(smokeColor, alpha * smokeParams.colour.a);
}
