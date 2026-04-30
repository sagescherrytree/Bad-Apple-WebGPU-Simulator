struct SmokeParams {
    colour: vec4<f32>,
    size: f32,
    jfaColour: f32,
    _pad0: f32,
    _pad1: f32,
};

struct RandomColOptions {
    nearColour: vec4<f32>,
    farColour: vec4<f32>,
    maxDist: f32,
    blend: f32, 
}

struct VSOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) particleUv: vec2<f32>,
};

@group(0) @binding(1) var<uniform> smokeParams: SmokeParams;
@group(0) @binding(2) var<uniform> randomColOptions: RandomColOptions;
@group(0) @binding(3) var jfaTexture: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2<f32>, @location(1) particleUv: vec2<f32>) -> @location(0) vec4<f32> {
    let center = vec2<f32>(0.5, 0.5);
    let d = distance(uv, center);
    let alpha = exp(-d * d * 12.0);

    var smokeColor = smokeParams.colour.rgb;

    if (smokeParams.jfaColour > 0.5) {
        let dims = vec2<i32>(textureDimensions(jfaTexture));
        let coord = vec2<i32>(particleUv * vec2<f32>(dims));
        let nearestSeed = textureLoad(jfaTexture, coord, 0).xy;

        let dist = distance(vec2<f32>(coord), nearestSeed);
        let t = clamp(dist / randomColOptions.maxDist, 0.0, randomColOptions.blend);

        let nearColour = randomColOptions.nearColour.rgb;
        let farColour = randomColOptions.farColour.rgb;
        smokeColor = mix(nearColour, farColour, t);
    }

    return vec4<f32>(smokeColor, alpha * smokeParams.colour.a);
}
