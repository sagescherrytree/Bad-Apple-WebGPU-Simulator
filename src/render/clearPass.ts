export class ClearPass {
    render(device: GPUDevice, context: GPUCanvasContext, time: number) {
        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();

        const red = Math.sin(time) * 0.5 + 0.5; // animates between 0 and 1

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view,
                clearValue: { r: red, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        pass.end();
        device.queue.submit([encoder.finish()]);

        console.log("ClearPass.render called, time=", time, "red=", red);
    }
}