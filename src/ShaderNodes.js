

/*********************************************************************/


/**
 * @author zz85 / https://github.com/zz85 | https://www.lab4games.net/zz85/blog
 *
 * Edge Detection Shader using Sobel filter
 * Based on http://rastergrid.com/blog/2011/01/frei-chen-edge-detector
 *
 * aspect: vec2 of (1/width, 1/height)
 */

THREE.EdgeShader2 = {

	uniforms: {

		"texture": { type: "t", value: null },
		"resolution":    { type: "v2", value: new THREE.Vector2( 512, 512 ) },
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D texture;",
		"varying vec2 vUv;",
		"uniform vec2 resolution;",


		"vec2 texel = vec2(1.0 / resolution.x, 1.0 / resolution.y);",

		"mat3 G[2];",

		"const mat3 g0 = mat3( 1.0, 2.0, 1.0, 0.0, 0.0, 0.0, -1.0, -2.0, -1.0 );",
		"const mat3 g1 = mat3( 1.0, 0.0, -1.0, 2.0, 0.0, -2.0, 1.0, 0.0, -1.0 );",


		"void main(void)",
		"{",
			"mat3 I;",
			"float cnv[2];",
			"vec3 sample;",

			"G[0] = g0;",
			"G[1] = g1;",

			/* fetch the 3x3 neighbourhood and use the RGB vector's length as intensity value */
			"for (float i=0.0; i<3.0; i++)",
			"for (float j=0.0; j<3.0; j++) {",
				"sample = texture2D( texture, vUv + texel * vec2(i-1.0,j-1.0) ).rgb;",
				"I[int(i)][int(j)] = length(sample);",
			"}",

			/* calculate the convolution values for all the masks */
			"for (int i=0; i<2; i++) {",
				"float dp3 = dot(G[i][0], I[0]) + dot(G[i][1], I[1]) + dot(G[i][2], I[2]);",
				"cnv[i] = dp3 * dp3; ",
			"}",

			"gl_FragColor = vec4(0.5 * sqrt(cnv[0]*cnv[0]+cnv[1]*cnv[1]));",
		"} ",

	].join("\n")

};



CRAYON.extends( 'EdgeFilterNode', CRAYON.PostProcessNode, {

	init: function() {

		var shaderMaterial = new THREE.ShaderMaterial( THREE.EdgeShader2 );
		shaderMaterial.uniforms.resolution.value.set( width / 2, height / 2 );

		CRAYON.PostProcessNode.call( this, renderer, shaderMaterial );
		this.renderTarget.width = width / 2;
		this.renderTarget.height = height / 2;
		this.inputs.requires('texture');

	}

} );


/**
 * @author zz85 / https://github.com/zz85 | https://www.lab4games.net/zz85/blog
 *
 * Edge Detection Shader using Sobel filter
 * Based on http://rastergrid.com/blog/2011/01/frei-chen-edge-detector
 *
 * aspect: vec2 of (1/width, 1/height)
 */

THREE.MultiplyNode = {

	uniforms: {

		"texture1": { type: "t", value: null },
		"texture2": { type: "t", value: null },
		"resolution":    { type: "v2", value: new THREE.Vector2( 512, 512 ) },
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D texture1;",
		"uniform sampler2D texture2;",
		"varying vec2 vUv;",
		"uniform vec2 resolution;",

		
		"void main(void)",
		"{",
			
			"vec3 c1 = texture2D( texture1, vUv ).rgb;",
			"vec3 c2 = texture2D( texture2, vUv ).rgb;",
			

			// "gl_FragColor = vec4((1. - (1. - c1) * (1. - c2)), 1.0);",
			// "gl_FragColor = vec4(c1 * c2, 1.0);",

			"gl_FragColor = vec4(c1 * (1.-c2), 1.0);",
		"} ",

	].join("\n")

};

CRAYON.extends( 'MultiplyNode', CRAYON.PostProcessNode, {

	init: function() {

		var shaderMaterial = new THREE.ShaderMaterial( THREE.MultiplyNode );
		shaderMaterial.uniforms.resolution.value.set( width, height );

		CRAYON.PostProcessNode.call( this, renderer, shaderMaterial );
		this.inputs.requires('texture1', 'texture2');

	}

} );


CRAYON.extends( 'SceneDepthNode', CRAYON.ShaderNode, {

	init: function( sceneNode ) {
		CRAYON.ShaderNode.call( this );

		// this.sceneNode = sceneNode;
		// this.material_depth = new THREE.MeshDepthMaterial({
		// 	morphTargets: true
		// });


		// var depthShader = THREE.ShaderLib.depthRGBA;
		// var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );

		// this.material_depth = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms, morphTargets: true } );

		this.inputs.requires('texture');

	},

	render: function() {

		scene.overrideMaterial = this.material_depth;
		
		renderer.clear();
		renderer.render( scene, camera, this.renderTarget );

		scene.overrideMaterial = null;

	}

});

CRAYON.extends( 'GradientEncoderNode', CRAYON.PostProcessNode, {
	
	init: function ( previousNode, top ) {

		var shaderMaterial = new THREE.ShaderMaterial( {
			uniforms: 		{
				texture: { type: 't', value: null },
				resolution: { type: 'v2', value: new THREE.Vector2(width, height) },
				top: { type: 'f', value: top }
			},
			attributes:     {},
			vertexShader:   getShaderCode('pass-vs'),
			fragmentShader: getShaderCode('fsGradientEncode')
		});

		CRAYON.PostProcessNode.call( this, renderer, shaderMaterial );
		this.inputs.requires('texture');

		var parameters = {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			type: THREE.FloatType,
			format: THREE.RGBAFormat,
			stencilBuffer: false
		};

		renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );

		this.encodedRenderTarget = renderTarget;

		this.pixels = new Uint8Array(width * height * 4);
		this.pixels32 = new Float32Array(this.pixels.buffer);

		this.renderTarget = previousNode.renderTarget;
		// this.renderTarget = this.encodedRenderTarget
	},

	render: function() {
		console.log('float!!!');
		
		this.renderer.render( this.scene, this.camera, this.encodedRenderTarget );
		// renderer.render( this.scene, this.camera, this.renderTarget );
		var gl = renderer.getContext();
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);

	}


});

CRAYON.extends( 'FloatEncoderNode', CRAYON.PostProcessNode, {

	init: function ( previousNode ) {

		var shaderMaterial = new THREE.ShaderMaterial( {
			uniforms: 		{
				texture: { type: 't', value: null },
				resolution: { type: 'v2', value: new THREE.Vector2(width, height) }
			},
			attributes:     {},
			vertexShader:   getShaderCode('pass-vs'),
			fragmentShader: getShaderCode('fsEncodeFloatX')
		});

		CRAYON.PostProcessNode.call( this, renderer, shaderMaterial );
		this.inputs.requires('texture');

		var parameters = {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			type: THREE.FloatType,
			format: THREE.RGBAFormat,
			stencilBuffer: false
		};

		renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );

		this.encodedRenderTarget = renderTarget;

		this.pixels = new Uint8Array(width * height * 4);
		this.pixels32 = new Float32Array(this.pixels.buffer);

		this.renderTarget = previousNode.renderTarget;
		this.renderTarget = this.encodedRenderTarget;

	},

	render: function() {

		this.renderer.render( this.scene, this.camera, this.encodedRenderTarget );
		// renderer.render( this.scene, this.camera, this.renderTarget );
		var gl = renderer.getContext();
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);

	}

} );




/*********************************************************************/