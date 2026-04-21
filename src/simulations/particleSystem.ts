import particleShader from "../shaders/particles.cs.wgsl?raw";
import particleVertShader from "../shaders/particles.vert.wgsl?raw";
import particleFragShader from "../shaders/particles.frag.wgsl?raw";

interface FluidParams {
    dt: number;
    forceScale: number;
    pressureIterations: number;
    dampening: number;
    epsilon: number,
}

// Particle parameters.
export interface ParticleParams {
    velocityScale: number;
}

export class ParticleSystem {
    particlesBuffer: GPUBuffer;
    particlesPipeline: GPUComputePipeline;
    particlesBindGroup: GPUBindGroup;

    // For rendering particles.
    renderPipeline: GPURenderPipeline;
    renderBindGroup: GPUBindGroup;

    private numParticles: number;
    private velocityScale: number;

    private particleParamsBuffer: GPUBuffer;

    // Accept params from fluid simulation.
    private fluidParams: FluidParams;
    // Buffer for fluid params.
    private fluidParamsBuffer: GPUBuffer;

    constructor(device: GPUDevice, numParticles: number, forceTexture: GPUTexture, binaryTexture: GPUTexture, format: GPUTextureFormat, fluidParams: FluidParams, advectionGain: number) {
        this.numParticles = numParticles;
        this.velocityScale = advectionGain;

        this.fluidParams = fluidParams || {
            dt: 0.016,
            forceScale: 1.0,
            pressureIterations: 20,
            dampening: 0.99,
            epsilon: 1.0,
        };

        // Set up particles buffer.
        this.particlesBuffer = device.createBuffer({
            label: "ParticlesBuffer",
            size: numParticles * 4 * 4, // 2 vec2<f32> per particle.
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
        });

        // Set up fluid params buffer.
        this.fluidParamsBuffer = device.createBuffer({
            label: "FluidParamsBuffer",
            size: 16 * 5, // 5 float values (dt, forceScale, pressureIterations, dampening, epsilon).
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.particleParamsBuffer = device.createBuffer({
            label: "ParticleParamsBuffer",
            size: 16, // 1 float value (velocityScale).
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        // Le compute pipeline.
        this.particlesPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: particleShader }),
                entryPoint: "main",
            },
        });

        this.particlesBindGroup = device.createBindGroup({
            layout: this.particlesPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particlesBuffer } },
                { binding: 1, resource: forceTexture.createView() },
                { binding: 2, resource: binaryTexture.createView() },
                { binding: 3, resource: { buffer: this.fluidParamsBuffer } },
                { binding: 4, resource: { buffer: this.particleParamsBuffer } },
            ],
        });

        const renderBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" },
                },
            ],
        });

        this.renderBindGroup = device.createBindGroup({
            layout: renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.particlesBuffer } },
            ],
        });

        const renderPipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [renderBindGroupLayout],
        });

        // Le render pipeline.
        this.renderPipeline = device.createRenderPipeline({
            layout: renderPipelineLayout,
            vertex: {
                module: device.createShaderModule({ code: particleVertShader }),
                entryPoint: "main",
            },
            fragment: {
                module: device.createShaderModule({ code: particleFragShader }),
                entryPoint: "main",
                targets: [{ format: format }],
            },
            primitive: {
                topology: "triangle-list",  // was "point-list"
            },
        });

        // Initialize particles.
        const initialData = new Float32Array(numParticles * 4); // pos.xy, vel.xy
        for (let i = 0; i < numParticles; i++) {
            initialData[i * 4 + 0] = Math.random(); // pos.x [0,1]
            initialData[i * 4 + 1] = Math.random(); // pos.y [0,1]
            initialData[i * 4 + 2] = 0; // vel.x
            initialData[i * 4 + 3] = 0; // vel.y
        }
        device.queue.writeBuffer(this.particlesBuffer, 0, initialData);

        // Initialize fluid sim params buffer.
        const fluidSimParams = new Float32Array(5);

        fluidSimParams[0] = this.fluidParams.dt;
        fluidSimParams[1] = this.fluidParams.forceScale;
        fluidSimParams[2] = this.fluidParams.pressureIterations;
        fluidSimParams[3] = this.fluidParams.dampening;
        fluidSimParams[4] = this.fluidParams.epsilon;

        device.queue.writeBuffer(this.fluidParamsBuffer, 0, fluidSimParams);

        const particleParamsData = new Float32Array(4);
        particleParamsData[0] = this.velocityScale;
        device.queue.writeBuffer(this.particleParamsBuffer, 0, particleParamsData);
    }

    // Update particle count (recreate buffer and bind groups).
    setParticleCount(device: GPUDevice, nextCount: number, forceTexture: GPUTexture, binaryTexture: GPUTexture) {
        if (nextCount === this.numParticles) return;

        // Create new buffer with updated size.
        const newPartBuffer = device.createBuffer({
            label: "ParticlesBuffer",
            size: nextCount * 4 * 4, // 4 floats per particle, 4 bytes each
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
        });

        // Copy existing particle data to the new buffer.
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.particlesBuffer, 0, newPartBuffer, 0, Math.min(this.numParticles, nextCount) * 4 * 4);
        device.queue.submit([encoder.finish()]);

        // Update the particles buffer reference.
        this.particlesBuffer = newPartBuffer;
        this.numParticles = nextCount;
    }

    step(device: GPUDevice, forceTexture: GPUTexture, binaryTexture: GPUTexture) {
        // Rewrite updated values for fluid sim params buffer.
        const fluidSimParams = new Float32Array(5);

        fluidSimParams[0] = this.fluidParams.dt;
        fluidSimParams[1] = this.fluidParams.forceScale;
        fluidSimParams[2] = this.fluidParams.pressureIterations;
        fluidSimParams[3] = this.fluidParams.dampening;
        fluidSimParams[4] = this.fluidParams.epsilon;

        device.queue.writeBuffer(this.fluidParamsBuffer, 0, fluidSimParams);

        const particleParamsData = new Float32Array(4);
        particleParamsData[0] = this.velocityScale;
        device.queue.writeBuffer(this.particleParamsBuffer, 0, particleParamsData);

        // Reuse buffer; update bind group with current velocity texture
        this.particlesBindGroup = device.createBindGroup({
            layout: this.particlesPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particlesBuffer } },
                { binding: 1, resource: forceTexture.createView() },
                { binding: 2, resource: binaryTexture.createView() },
                { binding: 3, resource: { buffer: this.fluidParamsBuffer } },
                { binding: 4, resource: { buffer: this.particleParamsBuffer } },
            ],
        });

        this.renderBindGroup = device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particlesBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.particlesPipeline);
        pass.setBindGroup(0, this.particlesBindGroup);

        // Dispatch enough threads for all particles
        const workgroups = Math.ceil(this.numParticles / 64);
        pass.dispatchWorkgroups(workgroups);

        pass.end();
        device.queue.submit([encoder.finish()]);
    }

    render(device: GPUDevice, view: GPUTextureView) {
        const encoder = device.createCommandEncoder();
        const textureView = view;

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "load",
                    storeOp: "store",
                },
            ],
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.renderBindGroup);
        renderPass.draw(this.numParticles * 6, 1, 0, 0);

        renderPass.end();
        device.queue.submit([encoder.finish()]);
    }
}