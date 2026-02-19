@group(0) @binding(0)
var vectorIn : texture_storage_2d<rgba32float, read>;

@group(0) @binding(1)
var vectorOut : texture_storage_2d<rgba32float, write>;

@group(0) @binding(2)
var<uniform> stepSize : u32;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {

    let dims = textureDimensions(vectorOut);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    let uv = vec2<i32>(id.xy);
    var bestCoord = textureLoad(vectorIn, uv).xy;

    var bestDist = 1e20;

    if (bestCoord.x >= 0.0) {
        bestDist = distance(vec2<f32>(id.xy), bestCoord);
    }

    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {

            let samplePos = uv + vec2<i32>(dx * i32(stepSize), dy * i32(stepSize));

            if (samplePos.x < 0 || samplePos.y < 0 ||
                samplePos.x >= i32(dims.x) || samplePos.y >= i32(dims.y)) {
                continue;
            }

            let candidate = textureLoad(vectorIn, samplePos).xy;

            if (candidate.x < 0.0) { continue; }

            let dist = distance(vec2<f32>(id.xy), candidate);

            if (dist < bestDist) {
                bestDist = dist;
                bestCoord = candidate;
            }
        }
    }

    textureStore(vectorOut, uv, vec4<f32>(bestCoord, 0.0, 0.0));
}
