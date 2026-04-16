struct SimParams {
    dt: f32,
    forceScale: f32,
    dampening: f32,
    width: f32,
    height: f32,
};

@group(0) @binding(0)
var pressureIn : texture_storage_2d<rgba32float, read>;
@group(0) @binding(1)
var pressureOut : texture_storage_2d<rgba32float, write>;
@group(0) @binding(2)
var divergence : texture_storage_2d<rgba32float, read>;
@group(0) @binding(3)
var<uniform> params : SimParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    if (id.x >= u32(params.width) || id.y >= u32(params.height)) {
        return;
    }

    let x = i32(id.x);
    let y = i32(id.y);

    let left  = textureLoad(pressureIn, vec2<i32>(max(x-1,0), y)).x;
    let right = textureLoad(pressureIn, vec2<i32>(min(x+1,i32(params.width)-1), y)).x;
    let down  = textureLoad(pressureIn, vec2<i32>(x, max(y-1,0))).x;
    let up    = textureLoad(pressureIn, vec2<i32>(x, min(y+1,i32(params.height)-1))).x;

    let div = textureLoad(divergence, vec2<i32>(x,y)).x;

    let p = (left + right + up + down - div) * 0.25;

    textureStore(pressureOut, vec2<i32>(x,y), vec4<f32>(p, 0.0, 0.0, 0.0));
}