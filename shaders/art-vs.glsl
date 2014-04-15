/*
 * Art Shader from the Wagner Project
 * https://github.com/spite/Wagner
 */

varying vec2 vUv;

void main()	{

	vUv = uv;

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}