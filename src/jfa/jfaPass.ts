// Call jfaCompute.cs.wgsl here to compute out vectors for JFA.
import jfaComputeShader from "../shaders/jfaCompute.cs.wgsl?raw";

export class JumpFloodAlgorithm {
    pipeline: GPUComputePipeline;

    constructor(device: GPUDevice) {
        this.pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: jfaComputeShader }),
                entryPoint: "main"
            }
        });
    }

    dispatch(device: GPUDevice, width: number, height: number,
        texA: GPUTexture, texB: GPUTexture) {

        let input = texA;
        let output = texB;

        let maxDim = Math.max(width, height);
        let step = Math.pow(2, Math.ceil(Math.log2(maxDim))) / 2;

        while (step >= 1) {

            const uniformBuffer = device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([step]));

            const bindGroup = device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: input.createView() },
                    { binding: 1, resource: output.createView() },
                    { binding: 2, resource: { buffer: uniformBuffer } }
                ]
            });

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();

            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(
                Math.ceil(width / 8),
                Math.ceil(height / 8)
            );

            pass.end();
            device.queue.submit([encoder.finish()]);

            [input, output] = [output, input];
            step = Math.floor(step / 2);
        }
    }

    getFinalTexture(texA: GPUTexture, texB: GPUTexture, width: number, height: number): GPUTexture {
        let maxDim = Math.max(width, height);
        let steps = Math.ceil(Math.log2(maxDim));
        // If steps is even, final texture is texA; else texB
        return (steps % 2 === 0) ? texA : texB;
    }
}

// For testing if JFA is working. 
export class VectorFieldDebug {
    device: GPUDevice;
    vectorTexture: GPUTexture;
    // Test, add back in canvas size buffer.
    canvasSizeBuffer: GPUBuffer;
    pipeline: GPURenderPipeline;

    constructor(device: GPUDevice, vectorTexture: GPUTexture, format: GPUTextureFormat, width: number, height: number) {
        this.device = device;
        this.vectorTexture = vectorTexture;

        // Initialise canvas size buffer.
        this.canvasSizeBuffer = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.canvasSizeBuffer, 0, new Float32Array([width, height]));

        this.pipeline = this.createPipeline(device, format);
    }

    createPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
        // Simple full-screen quad rendering pipeline
        const pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
                    code: `
                    struct VSOut {
                        @builtin(position) position: vec4<f32>,
                        @location(0) uv: vec2<f32>,
                    };

                    @vertex
                    fn main(@builtin(vertex_index) i: u32) -> VSOut {
                        var positions = array<vec2<f32>, 6>(
                            vec2(-1.0, -1.0),
                            vec2( 1.0, -1.0),
                            vec2(-1.0,  1.0),
                            vec2(-1.0,  1.0),
                            vec2( 1.0, -1.0),
                            vec2( 1.0,  1.0)
                        );

                        var uvs = array<vec2<f32>, 6>(
                            vec2(0.0, 1.0),
                            vec2(1.0, 1.0),
                            vec2(0.0, 0.0),
                            vec2(0.0, 0.0),
                            vec2(1.0, 1.0),
                            vec2(1.0, 0.0)
                        );

                        var out: VSOut;
                        out.position = vec4<f32>(positions[i], 0.0, 1.0);
                        out.uv = uvs[i];
                        return out;
                    }`,
                }),
                entryPoint: "main",
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
                    @group(0) @binding(0) var vectorTex: texture_2d<f32>;
                    @group(0) @binding(1) var<uniform> canvasSize: vec2<f32>;

                    @fragment fn main(@builtin(position) fragCoord: vec4<f32>) 
                    -> @location(0) vec4<f32> { 

                        let texDims = textureDimensions(vectorTex);
                        let texDimsF = vec2<f32>(texDims);

                        // Normalize fragCoord across full canvas
                        let uv = fragCoord.xy / canvasSize;

                        // Map to vector texture resolution
                        let uvTex = vec2<i32>(uv * texDimsF);

                        let v = textureLoad(vectorTex, uvTex, 0).xy; 
                        let color = vec2<f32>(v.x / texDimsF.x, v.y / texDimsF.y); 
                        return vec4<f32>(color, 0.0, 1.0); 
                    }`,
                }),
                entryPoint: "main",
                targets: [{ format }],
            },
            primitive: { topology: "triangle-list" },
        });
        return pipeline;
    }

    render(device: GPUDevice, context: GPUCanvasContext, width: number, height: number) {
        device.queue.writeBuffer(this.canvasSizeBuffer, 0, new Float32Array([width, height]));

        const encoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{ view: textureView, loadOp: "clear", storeOp: "store" }]
        });

        pass.setPipeline(this.pipeline);

        const bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.vectorTexture.createView() },
                { binding: 1, resource: { buffer: this.canvasSizeBuffer } }
            ]
        });

        pass.setBindGroup(0, bindGroup);
        pass.draw(6); // Full-screen quad
        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}