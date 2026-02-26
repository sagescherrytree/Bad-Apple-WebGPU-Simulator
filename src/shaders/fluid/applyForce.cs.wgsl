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
var forceTex : texture_storage_2d<rgba32float, read>;
@group(0) @binding(3)
var<uniform> params : SimParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    if (id.x >= u32(params.width) || id.y >= u32(params.height)) {
        return;
    }

    let coord = vec2<i32>(id.xy);

    let vel = textureLoad(velocityIn, coord);
    let force = textureLoad(forceTex, coord);

    let newVel = vel.xy + force.xy * params.forceScale * params.dt;

    textureStore(velocityOut, coord, vec4<f32>(newVel, 0.0, 0.0));
}