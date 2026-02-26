struct SimParams {
    dt: f32,
    forceScale: f32,
    width: f32,
    height: f32,
};

@group(0) @binding(0)
var velocityIn : texture_storage_2d<rgba32float, read>;
@group(0) @binding(1)
var velocityOut : texture_storage_2d<rgba32float, write>;
@group(0) @binding(2)
var pressure : texture_storage_2d<rgba32float, read>;
@group(0) @binding(3)
var<uniform> params : SimParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    if (id.x >= u32(params.width) || id.y >= u32(params.height)) {
        return;
    }

    let x = i32(id.x);
    let y = i32(id.y);

    let left  = textureLoad(pressure, vec2<i32>(max(x-1,0), y)).x;
    let right = textureLoad(pressure, vec2<i32>(min(x+1,i32(params.width)-1), y)).x;
    let down  = textureLoad(pressure, vec2<i32>(x, max(y-1,0))).x;
    let up    = textureLoad(pressure, vec2<i32>(x, min(y+1,i32(params.height)-1))).x;

    let grad = vec2<f32>(right - left, up - down) * 0.5;

    let vel = textureLoad(velocityIn, vec2<i32>(x,y)).xy;

    textureStore(velocityOut, vec2<i32>(x,y), vec4<f32>(vel - grad, 0.0, 0.0));
}