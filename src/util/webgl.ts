export function initShaderProgram(
    gl: WebGL2RenderingContext,
    vertSource: string,
    fragSource: string,
): WebGLProgram {
    const vertShader = loadShader(gl, gl.VERTEX_SHADER, vertSource);
    const fragShader = loadShader(gl, gl.FRAGMENT_SHADER, fragSource);

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
        throw new Error('Could not create program');
    }

    gl.attachShader(shaderProgram, vertShader);
    gl.attachShader(shaderProgram, fragShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        const message = `Could not initialize program: ${gl.getProgramInfoLog(
            shaderProgram,
        )}`;
        gl.deleteProgram(shaderProgram);
        throw new Error(message);
    }

    return shaderProgram;
}

export function loadShader(
    gl: WebGL2RenderingContext,
    type: GLenum,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error(`Could not create shader with type ${type}`);
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = `Could not compile shader: ${gl.getShaderInfoLog(
            shader,
        )}`;
        gl.deleteShader(shader);
        throw new Error(message);
    }

    return shader;
}
