struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
};

struct FluidSimParams {
    dt: f32,
    forceScale: f32,
    pressureIterations: f32,
    dampening: f32,
    epsilon: f32, 
    dx: f32,
};

struct ParticleParams {
    velocityScale: f32
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var forceTex  : texture_2d<f32>;   // JFA force vectors
@group(0) @binding(2) var binaryTex : texture_2d<f32>;   // binary texture for silhouette (white = outside, black = inside)
@group(0) @binding(3) var<uniform> fluidParams : FluidSimParams;
@group(0) @binding(4) var<uniform> particleParams : ParticleParams;

fn hash(n: u32) -> f32 {
    var x = n;
    x = x ^ (x >> 16u);
    x = x * 0x45d9f3bu;
    x = x ^ (x >> 16u);
    return f32(x) / f32(0xffffffffu);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= arrayLength(&particles)) { return; }

    var p = particles[id.x];
    let texSize = vec2<f32>(textureDimensions(forceTex));
    let texSizeI = vec2<i32>(texSize);

    // Sample force at current position directly from JFA force field.
    let pixel = clamp(vec2<i32>(p.pos * texSize), vec2<i32>(0), texSizeI - vec2<i32>(1));
    let force = textureLoad(forceTex, pixel, 0).xy;

    // Move particle along force field.
    let velocityScale = fluidParams.forceScale * particleParams.velocityScale;
    p.pos += force * velocityScale * fluidParams.dampening * fluidParams.dt;

    // Check if particle has left bounds or landed on a black pixel (inside silhouette)
    let newPixel = clamp(vec2<i32>(p.pos * texSize), vec2<i32>(0), texSizeI - vec2<i32>(1));
    let binaryVal = textureLoad(binaryTex, newPixel, 0).r;
    let outOfBounds = p.pos.x < 0.0 || p.pos.x > 1.0 || p.pos.y < 0.0 || p.pos.y > 1.0;

    // Respawn into a random white pixel if out of bounds or inside black region
    if (outOfBounds || binaryVal < 0.5) {
        // Use particle index + frame hash for pseudorandom respawn position
        let seed = id.x;
        var rx = hash(seed * 1973u + 9277u);
        var ry = hash(seed * 9277u + 1973u);
        p.pos = vec2<f32>(rx, ry);

        // Keep trying until we land in white — do a few iterations inline
        for (var i = 0u; i < 8u; i++) {
            let rPixel = vec2<i32>(vec2<f32>(rx, ry) * texSize);
            let val = textureLoad(binaryTex, clamp(rPixel, vec2<i32>(0), texSizeI - vec2<i32>(1)), 0).r;
            if (val >= 0.5) { break; }
            rx = hash(u32(rx * f32(0xffffu)) + seed + i);
            ry = hash(u32(ry * f32(0xffffu)) + seed + i + 1u);
            p.pos = vec2<f32>(rx, ry);
        }
    }

    particles[id.x] = p;
}