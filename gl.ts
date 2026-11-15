//
// MIT License
//
// Copyright (c) 2026 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// https://github.com/carlosrafaelgn/serenity
//

const generatedNoiseBlobs: Blob[] | null = null;

const canvas = document.createElement("canvas");
canvas.className = "fade";
canvas.width = baseWidth;
canvas.height = baseHeight;
document.body.appendChild(canvas);

const gl = canvas.getContext("webgl2", {
	alpha: false,
	depth: false,
	stencil: false,
	antialias: false,
	premultipliedAlpha: true
}) as WebGL2RenderingContext;

const programInfo = {
	program: null as WebGLProgram | null,
	attribLocations: {
		aPosition: 0,
	},
	uniformLocations: {
		uTime: null as WebGLUniformLocation | null,
		uOffset: null as WebGLUniformLocation | null,
		sBackground: null as WebGLUniformLocation | null,
		sCloudNoise: null as WebGLUniformLocation | null,
	},
};

async function setupWebGL(): Promise<boolean> {
	if (!gl) {
		alert("WebGL 2 not supported");
		return false;
	}

	let backgroundResolve: (() => void) | null = null;
	let backgroundReject: ((reason: any) => void) | null = null;

	const backgroundPromise = new Promise<void>(function (resolve, reject) {
		backgroundResolve = resolve;
		backgroundReject = reject;
	});

	const backgroundImage = new Image();
	backgroundImage.onload = backgroundResolve;
	backgroundImage.onerror = function (event, source, lineno, colno, error) {
		if (backgroundReject)
			backgroundReject(error || "Unknown error");
	};
	backgroundImage.src = "bg.png";

	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.disable(gl.DITHER);
	gl.disable(gl.SCISSOR_TEST);
	gl.disable(gl.POLYGON_OFFSET_FILL);
	gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
	gl.disable(gl.SAMPLE_COVERAGE);
	gl.disable(gl.STENCIL_TEST);
	gl.disable(gl.BLEND);

	function loadShader(type: number, source: string) {
		const shader = gl.createShader(type);
		if (!shader) {
			alert(`An unknown error occurred while compiling the shader type ${type}`);
			gl.deleteShader(shader);
			return null;
		}

		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			alert(`An error occurred while compiling the shader type ${type}: ${gl.getShaderInfoLog(shader)}`);
			gl.deleteShader(shader);
			return null;
		}

		return shader;
	}

	function initProgram(vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram | null {
		const vertexShader = loadShader(gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

		if (!vertexShader || !fragmentShader)
			return null;

		const shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert(`An error occurred while initializing the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
			return null;
		}

		return shaderProgram;
	}

	// Full-screen quad (2 triangles)
	const positions = new Float32Array([
		-1, 1, // Left Top
		-1, -1, // Left Bottom
		1, 1, // Right Top
		1, 1, // Right Top
		-1, -1, // Left Bottom
		1, -1, // Right Bottom
	]);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

	const noiseTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_3D, noiseTexture);
	gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, noiseResolution, noiseResolution, noiseResolution);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	if (generatedNoiseBlobs) {
		// A few devices just do not render the noise correctly regardless of the precision used... :(
		// Because of that, if we make const generatedNoiseBlobs: Blob[] | null = new Array(noiseResolution),
		// the app just generates the blobs that must be saved to their actual folder.

		const noiseGeneratorProgram = initProgram(noiseVertexShader, noiseGeneratorFragmentShader);
		if (!noiseGeneratorProgram) {
			alert("An error occurred while initializing the noise generator program");
			return false;
		}

		const noiseFBO = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, noiseFBO);
		gl.viewport(0, 0, noiseResolution, noiseResolution);
		gl.useProgram(noiseGeneratorProgram);

		const aPosition = gl.getAttribLocation(noiseGeneratorProgram, "aPosition");
		const uZDivResolution = gl.getUniformLocation(noiseGeneratorProgram, "uZDivResolution");

		// Reuse fullscreen rectangle for both noise generation and scene rendering
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.enableVertexAttribArray(aPosition);
		gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

		// * 4 = RGBA
		const pixels = new Uint8Array(noiseResolution * noiseResolution * 4);

		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = noiseResolution;
		tempCanvas.height = noiseResolution;
		const tempCtx = tempCanvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
		const imageData = tempCtx.createImageData(noiseResolution, noiseResolution);

		for (let z = 0; z < noiseResolution; z++) {
			gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, noiseTexture, 0, z);
			gl.uniform1f(uZDivResolution, z / noiseResolution);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			gl.flush();

			gl.readPixels(0, 0, noiseResolution, noiseResolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			imageData.data.set(pixels);

			tempCtx.putImageData(imageData, 0, 0);

			const blob = await new Promise<Blob | null>(function (resolve) {
				tempCanvas.toBlob(resolve, "image/png");
			});

			if (blob) {
				generatedNoiseBlobs.push(blob);
				console.log(`PNG ${z} generated`);
			} else {
				console.error(`Error generating PNG ${z}`);
				return false;
			}
		}

		gl.useProgram(null);
		gl.deleteProgram(noiseGeneratorProgram);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(noiseFBO);

		return false;
	} else {
		const div = document.createElement("div");
		div.className = "alert";
		div.textContent = "Loading data...";
		document.body.appendChild(div);

		const noiseImages = new Array(noiseResolution) as HTMLImageElement[];

		function loadNoiseImage(i: number): Promise<void> {
			return new Promise(function (resolve, reject) {
				const image = new Image();
				image.onload = function () {
					noiseImages[i] = image;
					resolve();
				};
				image.onerror = function (event: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) {
					reject(error || "Unknown error");
				};
				image.src = `pre-rendered-noise/noise-${(i < 10 ? "00" : (i < 100 ? "0" : ""))}${i}.png`;
			});
		}

		for (let i = 0; i < noiseResolution; i += 8) {
			const noisePromises = new Array(8) as Promise<void>[];

			for (let j = 0; j < 8; j++)
				noisePromises[i] = loadNoiseImage(i + j);

			try {
				await Promise.all(noisePromises);
			} catch (ex: any) {
				console.error(`Error loading noise images: ${(ex.message || ex.toString())}`);
				return false;
			}
		}

		for (let i = 0; i < noiseResolution; i++) {
			gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, i, noiseResolution, noiseResolution, 1, gl.RGBA, gl.UNSIGNED_BYTE, noiseImages[i]);
			noiseImages[i] = null as any;
		}

		document.body.removeChild(div);
	}

	gl.viewport(0, 0, canvas.width, canvas.height);

	const mainProgram = initProgram(mainVertexShader, mainFragmentShader);
	if (!mainProgram) {
		alert("An error occurred while initializing the main program");
		return false;
	}

	gl.useProgram(mainProgram);

	programInfo.program = mainProgram;
	programInfo.attribLocations.aPosition = gl.getAttribLocation(mainProgram, "aPosition");
	programInfo.uniformLocations.uTime = gl.getUniformLocation(mainProgram, "uTime");
	programInfo.uniformLocations.uOffset = gl.getUniformLocation(mainProgram, "uOffset");
	programInfo.uniformLocations.sBackground = gl.getUniformLocation(mainProgram, "sBackground");
	programInfo.uniformLocations.sCloudNoise = gl.getUniformLocation(mainProgram, "sCloudNoise");

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);
	gl.vertexAttribPointer(programInfo.attribLocations.aPosition, 2, gl.FLOAT, false, 0, 0);

	try {
		await backgroundPromise;
	} catch (ex: any) {
		alert(`An error occurred while loading the background image: ${(ex.message || ex.toString())}`);
		return false;
	}

	// Bind background sampler to texture 0
	gl.activeTexture(gl.TEXTURE0);
	const backgroundTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundImage);
	gl.uniform1i(programInfo.uniformLocations.sBackground, 0);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);

	// Bind cloudNoise sampler to texture 1
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_3D, noiseTexture);
	gl.uniform1i(programInfo.uniformLocations.sCloudNoise, 1);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	canvas.classList.add("in");

	setTimeout(function () {
		canvas.classList.remove("fade", "in");
	}, 1500);

	return true;
}
