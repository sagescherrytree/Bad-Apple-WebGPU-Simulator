@group(0) @binding(0)
var densityTex : texture_2d<f32>;

struct BlobCompositeParams {
    colour: vec4<f32>,
    threshold: f32,
    softness: f32,
    intensity: f32,
    _pad0: f32,
};

@group(0) @binding(1)
var<uniform> blobParams : BlobCompositeParams;

@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {

    let dims = vec2<i32>(textureDimensions(densityTex));
    let pixel = clamp(vec2<i32>(uv * vec2<f32>(dims)), vec2<i32>(0), dims - vec2<i32>(1));

    let density = textureLoad(densityTex, pixel, 0).r;

    let threshold = blobParams.threshold;
    let softness = max(blobParams.softness, 0.0001);

    let metaball = smoothstep(
        threshold - softness,
        threshold + softness,
        density
    );

    let colour = blobParams.colour.rgb * blobParams.intensity;

    return vec4<f32>(colour * metaball, metaball);
}
