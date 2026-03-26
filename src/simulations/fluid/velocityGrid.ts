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
        const forceScale = 1.0;

        const simParams = new Float32Array(4);

        simParams[0] = dt;
        simParams[1] = forceScale;
        simParams[2] = this.width;
        simParams[3] = this.height;

        device.queue.writeBuffer(
            this.simUniformBuffer,
            0,
            simParams
        );

        // Force.
        this.runComputePass(
            device,
            encoder,
            this.applyForcePipeline,
            this.velocityA,
            this.velocityB,
            externalForceTex
        );
        this.swapVelocity();

        // Advection.
        this.runSmallComputePass(
            device,
            encoder,
            this.advectPipeline,
            this.velocityA, // velocityIn
            this.velocityB, // velocityOut
        );
        this.swapVelocity();

        // Divergence.
        this.runSmallComputePass(
            device,
            encoder,
            this.divergencePipeline,
            this.velocityA, // velocityIn
            this.divergence,// divergenceOut
        );

        // Solve pressure.
        for (let i = 0; i < PRESSURE_ITERS; i++) {
            this.runComputePass(
                device,
                encoder,
                this.pressurePipeline,
                this.pressureA, // pressureIn
                this.pressureB, // pressureOut
                this.divergence // divergence
            );
            this.swapPressure();
        }

        // Gradient.
        this.runComputePass(
            device,
            encoder,
            this.gradientPipeline,
            this.velocityA, // velocityIn
            this.velocityB, // velocityOut
            this.pressureA  // solved pressure
        );
        this.swapVelocity();

        device.queue.submit([encoder.finish()]);
    }

    getVelocityTexture(): GPUTexture {
        return this.velocityA;
    }

    // Compute pass for apply force.
    private runComputePass(
        device: GPUDevice,
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        texIn: GPUTexture,
        texOut: GPUTexture,
        extraTex: GPUTexture
    ) {
        // Bind group entries must correctly match the shader bindings:
        // 0: velocityIn, 1: velocityOut, 2: force/divergence/pressure, 3: uniform buffer
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texIn.createView() },
                { binding: 1, resource: texOut.createView() },
                { binding: 2, resource: extraTex.createView() },
                { binding: 3, resource: { buffer: this.simUniformBuffer } }
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

    private runSmallComputePass(
        device: GPUDevice,
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        texIn: GPUTexture,
        texOut: GPUTexture
    ) {
        // Bind group entries must correctly match the shader bindings:
        // 0: velocityIn, 1: velocityOut, 2: uniform buffer
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: texIn.createView() },
                { binding: 1, resource: texOut.createView() },
                { binding: 2, resource: { buffer: this.simUniformBuffer } }
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

// Debug velocity texture.
export class VelocityDebugPass {
    pipeline: GPURenderPipeline;

    constructor(device: GPUDevice, format: GPUTextureFormat) {

        // ---------- Vertex ----------
        const vertModule = device.createShaderModule({
            code: `
                struct VSOut {
                    @builtin(position) pos: vec4<f32>,
                    @location(0) uv: vec2<f32>,
                };

                @vertex
                fn main(@builtin(vertex_index) index: u32) -> VSOut {

                    // Fullscreen triangle
                    var positions = array<vec2<f32>, 3>(
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 3.0, -1.0),
                        vec2<f32>(-1.0,  3.0)
                    );

                    // Proper 0-1 UVs
                    var uvs = array<vec2<f32>, 3>(
                        vec2<f32>(0.0, 0.0),
                        vec2<f32>(2.0, 0.0),
                        vec2<f32>(0.0, 2.0)
                    );

                    var out: VSOut;
                    out.pos = vec4<f32>(positions[index], 0.0, 1.0);
                    out.uv = uvs[index];
                    return out;
                }
            `
        });

        // ---------- Fragment ----------
        const fragModule = device.createShaderModule({
            code: `
                @group(0) @binding(0)
                var velocityTex: texture_2d<f32>;

                @fragment
                fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {

                    // Clamp UV to valid range
                    let uvClamped = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));

                    // Get texture size (i32) and convert to f32
                    let texSizeI = textureDimensions(velocityTex);
                    let texSize = vec2<f32>(texSizeI);

                    // Convert UV to integer pixel coordinate
                    let pixel = vec2<i32>(uvClamped * texSize);

                    let velocity = textureLoad(velocityTex, pixel, 0).xy;

                    // Scale velocity for visibility

                    let angle = atan2(velocity.y, velocity.x);
                    let mag = length(velocity.xy);

                    // Map angle to 0→1
                    let hue = (angle / 6.28318530718) + 0.5;

                    // HSV → RGB approximation
                    let c = vec3<f32>(
                        abs(hue*6.0 - 3.0) - 1.0,
                        2.0 - abs(hue*6.0 - 2.0),
                        2.0 - abs(hue*6.0 - 4.0)
                    );

                    let rgb = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

                    // --- Normalize magnitude ---
                    let maxVel = 5.0; // tweak this to your simulation's typical max velocity
                    let brightness = clamp(mag / maxVel, 0.0, 1.0);

                    let color = vec4<f32>(rgb * brightness, 1.0);

                    return color;
                }
            `
        });

        // ---------- Bind Group Layout ----------
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d",
                        multisampled: false
                    }
                }
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        this.pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertModule,
                entryPoint: "main"
            },
            fragment: {
                module: fragModule,
                entryPoint: "main",
                targets: [{ format }]
            },
            primitive: {
                topology: "triangle-list"
            }
        });
    }

    render(device: GPUDevice, context: GPUCanvasContext, velocityTexture: GPUTexture) {
        const encoder = device.createCommandEncoder();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }]
        });

        const bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: velocityTexture.createView() }
            ]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}