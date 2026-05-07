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
    velocityScale: f32,
    colour: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var forceTex  : texture_2d<f32>;   // JFA force vectors
@group(0) @binding(2) var binaryTex : texture_2d<f32>;   // white = spawnable, black = filtered
@group(0) @binding(3) var<uniform> fluidParams : FluidSimParams;
@group(0) @binding(4) var<uniform> particleParams : ParticleParams;

fn hash(n: u32) -> f32 {
    var x = n;
    x = x ^ (x >> 16u);
    x = x * 0x45d9f3bu;
    x = x ^ (x >> 16u);
    return f32(x) / f32(0xffffffffu);
}

fn maskValue(pos: vec2<f32>, texSize: vec2<f32>, texSizeI: vec2<i32>) -> f32 {
    let pixel = clamp(vec2<i32>(pos * texSize), vec2<i32>(0), texSizeI - vec2<i32>(1));
    return textureLoad(binaryTex, pixel, 0).r;
}

fn isSpawnable(pos: vec2<f32>, texSize: vec2<f32>, texSizeI: vec2<i32>) -> bool {
    return maskValue(pos, texSize, texSizeI) >= 0.05;
}

fn randomSpawn(seed: u32, texSize: vec2<f32>, texSizeI: vec2<i32>) -> vec2<f32> {
    var rx = hash(seed * 1973u + 9277u);
    var ry = hash(seed * 9277u + 1973u);
    var candidate = vec2<f32>(rx, ry);

    for (var i = 0u; i < 32u; i++) {
        if (isSpawnable(candidate, texSize, texSizeI)) {
            return candidate;
        }

        rx = hash(seed * 1664525u + i * 1013904223u + u32(ry * f32(0xffffu)));
        ry = hash(seed * 22695477u + i * 1103515245u + u32(rx * f32(0xffffu)));
        candidate = vec2<f32>(rx, ry);
    }

    let dims = textureDimensions(binaryTex);
    let total = dims.x * dims.y;
    let start = (seed * 747796405u + 2891336453u) % total;

    for (var i = 0u; i < 256u; i++) {
        let index = (start + i * 7919u) % total;
        let pixel = vec2<i32>(i32(index % dims.x), i32(index / dims.x));
        let val = textureLoad(binaryTex, pixel, 0).r;

        if (val >= 0.5) {
            return (vec2<f32>(pixel) + vec2<f32>(0.5)) / texSize;
        }
    }

    return vec2<f32>(-1.0, -1.0);
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
    let delta = force * velocityScale * fluidParams.dampening * fluidParams.dt;
    p.vel = delta;
    p.pos += delta;

    let outOfBounds = p.pos.x < 0.0 || p.pos.x > 1.0 || p.pos.y < 0.0 || p.pos.y > 1.0;

    // Respawn into a white pixel if out of bounds or inside a black region.
    if (outOfBounds || !isSpawnable(p.pos, texSize, texSizeI)) {
        p.pos = randomSpawn(id.x, texSize, texSizeI);
        p.vel = vec2<f32>(0.0, 0.0);
    }

    particles[id.x] = p;
}
