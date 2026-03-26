@group(0) @binding(0) var jfaTex   : texture_storage_2d<rgba32float, read>;
@group(0) @binding(1) var forceTex : texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(forceTex);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    let coord = vec2<i32>(id.xy);
    let nearest = textureLoad(jfaTex, coord).xy;

    var force = vec2<f32>(0.0, 0.0);
    let dir = nearest - vec2<f32>(id.xy);
    let len = length(dir);
    if (len > 0.5) {
        force = dir / len;
        force.y = -force.y;
    }

    textureStore(forceTex, coord, vec4<f32>(force, 0.0, 0.0));
}