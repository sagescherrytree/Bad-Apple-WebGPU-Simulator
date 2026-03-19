import particleShader from "../shaders/particles.cs.wgsl?raw";
import particleVertShader from "../shaders/particles.vert.wgsl?raw";
import particleFragShader from "../shaders/particles.frag.wgsl?raw";

export class ParticleSystem {
    particlesBuffer: GPUBuffer;
    particlesPipeline: GPUComputePipeline;
    particlesBindGroup: GPUBindGroup;

    // For rendering particles.
    renderPipeline: GPURenderPipeline;
    renderBindGroup: GPUBindGroup;

    private numParticles: number;

    constructor(device: GPUDevice, numParticles: number, velocityTexture: GPUTexture) {
        this.numParticles = numParticles;

        // Set up particles buffer.
        this.particlesBuffer = device.createBuffer({
            label: "ParticlesBuffer",
            size: numParticles * 4 * 4, // 2 vec2<f32> per particle.
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.VERTEX,
        });

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
                { binding: 1, resource: velocityTexture.createView() },
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
                targets: [{ format: "bgra8unorm" }],
            },
            primitive: {
                topology: "point-list",
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
    }

    step(device: GPUDevice, velocityTexture: GPUTexture) {
        // Reuse buffer; update bind group with current velocity texture
        this.particlesBindGroup = device.createBindGroup({
            layout: this.particlesPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.particlesBuffer } },
                { binding: 1, resource: velocityTexture.createView() },
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
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.renderBindGroup);
        renderPass.draw(this.numParticles, 1, 0, 0);

        renderPass.end();
        device.queue.submit([encoder.finish()]);
    }
}