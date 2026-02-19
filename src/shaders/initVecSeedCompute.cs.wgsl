@group(0) @binding(0)
var binaryTex : texture_2d<f32>; // The binary texture from video.

@group(0) @binding(1)
var vectorOut : texture_storage_2d<rgba32float, write>; // Vector seed map, to be passed into JFA.

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    let dims = textureDimensions(vectorOut);
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let uv = vec2<i32>(id.xy);
    let value = textureLoad(binaryTex, uv, 0).r;

    // Decide which colour is your seed.
    // Example: black pixels are seeds.
    if (value < 0.5) {
        // Store absolute coordinate of seed
        textureStore(vectorOut, uv, vec4<f32>(f32(id.x), f32(id.y), 0.0, 0.0));
    } else {
        // Store invalid coordinate
        textureStore(vectorOut, uv, vec4<f32>(-1.0, -1.0, 0.0, 0.0));
    }
}
