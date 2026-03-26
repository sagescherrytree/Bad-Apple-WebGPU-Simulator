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
var<uniform> params : SimParams;

fn clampCoord(coord: vec2<f32>) -> vec2<i32> {
    return vec2<i32>(
        i32(clamp(coord.x, 0.0, params.width - 1.0)),
        i32(clamp(coord.y, 0.0, params.height - 1.0))
    );
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    if (id.x >= u32(params.width) || id.y >= u32(params.height)) {
        return;
    }

    let coord = vec2<f32>(id.xy);
    let vel = textureLoad(velocityIn, vec2<i32>(id.xy)).xy;

    // Compute the previous position along the velocity field.
    let prevPos = coord - vel * params.dt;

    let damping = 0.2;

    // Clamp coordinates to the grid.
    let samplePos = clampCoord(prevPos);

    // Sample velocity at previous position.
    let sampledVel = textureLoad(velocityIn, samplePos).xy;
    textureStore(velocityOut, vec2<i32>(id.xy), vec4<f32>(sampledVel * damping, 0.0, 0.0));
}