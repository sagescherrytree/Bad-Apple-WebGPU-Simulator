struct SimParams {
    dt: f32,
    forceScale: f32,
    dampening: f32,
    width: f32,
    height: f32,
    epsilon: f32, 
    dx: f32,
};

@group(0) @binding(0)
var velIn : texture_storage_2d<rgba32float, read>;
@group(0) @binding(1)
var velOut : texture_storage_2d<rgba32float, write>;
@group(0) @binding(2)
var<uniform> params : SimParams;

fn loadVel(x: i32, y: i32) -> vec2<f32> {
    let cx = clamp(x, 0, i32(params.width)  - 1);
    let cy = clamp(y, 0, i32(params.height) - 1);
    return textureLoad(velIn, vec2<i32>(cx, cy)).xy;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    if (id.x >= u32(params.width) || id.y >= u32(params.height)) { return; }

    let x = i32(id.x);
    let y = i32(id.y);

    // Compute vorticity (curl of velocity field) at cell centers via central differences.
    let uN = loadVel(x,     y + 1); // north
    let uS = loadVel(x,     y - 1); // south
    let uE = loadVel(x + 1, y    ); // east
    let uW = loadVel(x - 1, y    ); // west

    // Central difference.
    let inv2dx = 1.0 / (2.0 * params.dx);
    let omega  = (uE.y - uW.y) * inv2dx
               - (uN.x - uS.x) * inv2dx;

    let omegaCenter = omega; // already computed above

    // |ω| at neighbours (scalar curl at offset cells).
    let omegaN = (loadVel(x,     y + 2).y - loadVel(x,     y    ).y) * inv2dx
               - (loadVel(x + 1, y + 1).x - loadVel(x - 1, y + 1).x) * inv2dx;

    let omegaS = (loadVel(x,     y    ).y - loadVel(x,     y - 2).y) * inv2dx
               - (loadVel(x + 1, y - 1).x - loadVel(x - 1, y - 1).x) * inv2dx;

    let omegaE = (loadVel(x + 2, y    ).y - loadVel(x,     y    ).y) * inv2dx
               - (loadVel(x + 1, y + 1).x - loadVel(x + 1, y - 1).x) * inv2dx;

    let omegaW = (loadVel(x,     y    ).y - loadVel(x - 2, y    ).y) * inv2dx
               - (loadVel(x - 1, y + 1).x - loadVel(x - 1, y - 1).x) * inv2dx;

    var eta = vec2<f32>(
        (abs(omegaE) - abs(omegaW)) * inv2dx,
        (abs(omegaN) - abs(omegaS)) * inv2dx
    );

    let etaLen = length(eta);
    if (etaLen < 1e-5) {
        // No meaningful vorticity gradient — write velocity unchanged.
        textureStore(velOut, vec2<i32>(x, y),
                     vec4<f32>(loadVel(x, y), 0.0, 0.0));
        return;
    }
    let N = eta / etaLen;

    let forceConfinement = params.epsilon * params.dx * vec2<f32>(-N.y, N.x) * omegaCenter;

    // Apply force confinement to velocity.
    let vel    = loadVel(x, y);
    let newVel = vel + forceConfinement * params.dt;

    textureStore(velOut, vec2<i32>(x, y), vec4<f32>(newVel, 0.0, 0.0));
}
