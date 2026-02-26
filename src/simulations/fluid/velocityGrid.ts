import forceShader from "../../shaders/fluid/applyForce.cs.wgsl?raw";
import advectShader from "../../shaders/fluid/advectVelocity.cs.wgsl?raw";
import divergenceShader from "../../shaders/fluid/computeDivergence.cs.wgsl?raw";
import pressureShader from "../../shaders/fluid/pressure.cs.wgsl?raw";
import gradientShader from "../../shaders/fluid/subtractGradient.cs.wgsl?raw";

const WORKGROUP_SIZE = 8;
const PRESSURE_ITERS = 20;

export class VelocityGrid {
    width: number;
    height: number;

    // The textures.
    private velocityA: GPUTexture;
    private velocityB: GPUTexture;
    private pressureA: GPUTexture;
    private pressureB: GPUTexture;
    private divergence: GPUTexture;

    // Buffer for simulation.
    private simUniformBuffer: GPUBuffer;

    // Compute pipelines for each step in fluid sim.
    private applyForcePipeline: GPUComputePipeline;
    private advectPipeline: GPUComputePipeline;
    private divergencePipeline: GPUComputePipeline;
    private pressurePipeline: GPUComputePipeline;
    private gradientPipeline: GPUComputePipeline;

    constructor(device: GPUDevice, width: number, height: number) {
        this.width = width;
        this.height = height;

        // Create textures. 
        this.velocityA = this.createTexture(device, "VelocityATexture");
        this.velocityB = this.createTexture(device, "VelocityBTexture");
        this.pressureA = this.createTexture(device, "PressureA");
        this.pressureB = this.createTexture(device, "PressureB");
        this.divergence = this.createTexture(device, "Divergence");

        this.simUniformBuffer = device.createBuffer({
            size: 4 * 4, // dt, width, height, padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Initialise pipelines.
        this.applyForcePipeline = this.createPipeline(device, "applyForcePipeline", forceShader);
        this.advectPipeline = this.createPipeline(device, "advectPipeline", advectShader);
        this.divergencePipeline = this.createPipeline(device, "divergencePipeline", divergenceShader);
        this.pressurePipeline = this.createPipeline(device, "pressurePipeline", pressureShader);
        this.gradientPipeline = this.createPipeline(device, "gradientPipeline", gradientShader);
    }

    step(device: GPUDevice, dt: number, externalForceTex: GPUTexture) {
        const encoder = device.createCommandEncoder();

        // Update uniform buffer
        device.queue.writeBuffer(
            this.simUniformBuffer,
            0,
            new Float32Array([dt, this.width, this.height, 0])
        );

        // Force.
        this.runPass(
            device,
            encoder,
            this.applyForcePipeline,
            [
                this.velocityA.createView(),
                externalForceTex.createView(),
                this.velocityB.createView()
            ]
        );
        this.swapVelocity();

        // Advection.
        this.runPass(
            device,
            encoder,
            this.advectPipeline,
            [
                this.velocityA.createView(),
                this.velocityB.createView()
            ]
        );
        this.swapVelocity();

        // Divergence.
        this.runPass(
            device,
            encoder,
            this.divergencePipeline,
            [
                this.velocityA.createView(),
                this.divergence.createView()
            ]
        );

        // Solve pressure.
        for (let i = 0; i < PRESSURE_ITERS; i++) {
            this.runPass(
                device,
                encoder,
                this.pressurePipeline,
                [
                    this.pressureA.createView(),
                    this.divergence.createView(),
                    this.pressureB.createView()
                ]
            );
            this.swapPressure();
        }

        // Gradient.
        this.runPass(
            device,
            encoder,
            this.gradientPipeline,
            [
                this.velocityA.createView(),
                this.pressureA.createView(),
                this.velocityB.createView()
            ]
        );
        this.swapVelocity();

        device.queue.submit([encoder.finish()]);
    }

    getVelocityTexture(): GPUTexture {
        return this.velocityA;
    }

    private runPass(
        device: GPUDevice,
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        textureViews: GPUTextureView[]
    ) {
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                ...textureViews.map((view, i) => ({
                    binding: i,
                    resource: view
                })),
                {
                    binding: textureViews.length,
                    resource: { buffer: this.simUniformBuffer }
                }
            ]
        });

        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);

        pass.dispatchWorkgroups(
            Math.ceil(this.width / WORKGROUP_SIZE),
            Math.ceil(this.height / WORKGROUP_SIZE)
        );

        pass.end();
    }

    private createTexture(device: GPUDevice, label: string): GPUTexture {
        return device.createTexture({
            label: label,
            size: [this.width, this.height],
            format: "rgba32float",
            usage: GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.COPY_SRC,
        });
    }

    private createPipeline(device: GPUDevice, label: string, shaderCode: string): GPUComputePipeline {
        return device.createComputePipeline({
            label: label,
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: shaderCode }),
                entryPoint: "main"
            }
        });
    }

    private swapVelocity() {
        const tmp = this.velocityA;
        this.velocityA = this.velocityB;
        this.velocityB = tmp;
    }

    private swapPressure() {
        const tmp = this.pressureA;
        this.pressureA = this.pressureB;
        this.pressureB = tmp;
    }
}