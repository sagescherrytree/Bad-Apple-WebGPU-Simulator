struct FadeParams {
    fadeAmount: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0)
var trailIn : texture_2d<f32>;

@group(0) @binding(1)
var trailOut : texture_storage_2d<rgba8unorm, write>;

@group(0) @binding(2)
var<uniform> fadeParams : FadeParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let dims = textureDimensions(trailOut);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    let coord = vec2<i32>(id.xy);
    let current = textureLoad(trailIn, coord, 0);

    // Multiply RGB by fadeAmount; preserve alpha.
    let faded = vec4<f32>(
        current.rgb * fadeParams.fadeAmount,
        current.a
    );

    textureStore(trailOut, coord, faded);
}
