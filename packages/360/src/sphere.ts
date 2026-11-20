/**
 * Draws a 360° picture as the inside of a sphere, with WebGL 1, which every
 * browser down to Chromium 76 has.
 *
 * There is no sphere mesh. One rectangle covers the canvas, and the
 * fragment shader turns each pixel into a direction from the viewer, then
 * into the point of the picture that direction sees. That keeps the code
 * to one draw call and no geometry, and the picture stays sharp at any
 * field of view.
 */
import type { Projection, View } from './view.js';
import { rotation } from './view.js';

const VERTEX = `
attribute vec2 a_xy;
varying vec2 v_xy;
void main() {
  v_xy = a_xy;
  gl_Position = vec4(a_xy, 0.0, 1.0);
}`;

// lon 0 is the centre of the picture, and grows to the right. An
// equirectangular picture spans every longitude, a half one the front half;
// the rest of the sphere is black.
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_picture;
uniform mat3 u_turn;
uniform vec2 u_scale;
uniform float u_span;
varying vec2 v_xy;
const float PI = 3.14159265;
void main() {
  vec3 d = normalize(u_turn * vec3(v_xy * u_scale, -1.0));
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  float u = lon / u_span + 0.5;
  if (u < 0.0 || u > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(u_picture, vec2(u, 0.5 - lat / PI));
  }
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type) as WebGLShader;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

export class Sphere {
  declare private gl: WebGLRenderingContext;
  declare private turn: WebGLUniformLocation | null;
  declare private scale: WebGLUniformLocation | null;
  declare private span: WebGLUniformLocation | null;

  /** Throws when the browser gives no WebGL context. */
  constructor(canvas: HTMLCanvasElement) {
    const options = { alpha: false, antialias: false, depth: false, stencil: false };
    const gl = (canvas.getContext('webgl', options) ??
      canvas.getContext('experimental-webgl', options)) as WebGLRenderingContext | null;
    if (gl === null) throw new Error('webgl');
    this.gl = gl;
    const program = gl.createProgram() as WebGLProgram;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) throw new Error('webgl');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const xy = gl.getAttribLocation(program, 'a_xy');
    gl.enableVertexAttribArray(xy);
    gl.vertexAttribPointer(xy, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    // A video's size is rarely a power of two: WebGL 1 then needs clamping and no mipmaps.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.turn = gl.getUniformLocation(program, 'u_turn');
    this.scale = gl.getUniformLocation(program, 'u_scale');
    this.span = gl.getUniformLocation(program, 'u_span');
  }

  /**
   * Draws `picture` as seen from `view`. Throws a SecurityError for a
   * picture of another origin served without CORS.
   */
  draw(picture: TexImageSource, view: View, projection: Projection): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, picture);
    const tan = Math.tan(view.fov / 2);
    gl.uniformMatrix3fv(this.turn, false, rotation(view));
    gl.uniform2f(this.scale, (tan * canvas.width) / Math.max(1, canvas.height), tan);
    gl.uniform1f(this.span, projection === 'half-equirectangular' ? Math.PI : 2 * Math.PI);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Gives the GPU memory back now, rather than when the canvas is collected. */
  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
