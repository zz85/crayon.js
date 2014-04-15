/*
 * @author zz85 / https://github.com/zz85
 *
 * Related Readings
 *
 * http://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 * http://www.sunsetlakesoftware.com/2013/10/21/optimizing-gaussian-blurs-mobile-gpu
 * http://xissburg.com/faster-gaussian-blur-in-glsl/
 * https://github.com/manuelbua/blur-ninja
 *
 *
 * I'm writing this in the process of exploring optimized gaussian blurs,
 * but how well it really works in the real world I've yet to figure out.
 * For example, using varying to prevent dependent texture reads in the fragment 
 * shader might be a thing of the past.
 * http://stackoverflow.com/questions/1054096/what-is-a-dependent-texture-read 
 * 
 */

generateShaders() ;

function generateShaders(taps) {

	taps = taps || 9;

	var coefficients = calc(taps);
	var linear_weights = coefficients.linear_weights;
	var linear_offsets = coefficients.linear_offsets;

	var vertexShader = [

		"uniform float h;",
		"uniform float v;",
		"varying vec2 vBlurCoords[%d];",

		"void main() {",

			// "vUv = uv;",
			"vec2 uv3 = uv;",
			"vec2 offset = vec2(h, v);",
			"%s",
			// "vBlurCoords[0] = uv3 + offset * -3.2307692308;",
			// "vBlurCoords[1] = uv3 + offset * -1.3846153846;",
			// "vBlurCoords[2] = uv3 ;",
			// "vBlurCoords[3] = uv3 + offset * 1.3846153846;",
			// "vBlurCoords[4] = uv3 + offset * 3.2307692308;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n");


	var fragmentShader = [

		"uniform sampler2D tDiffuse;",
		
		"varying vec2 vBlurCoords[%d];",

		"void main() {",

			"vec4 sum = vec4( 0.0 );",

			"%s",

			// "sum += texture2D( tDiffuse, vBlurCoords[0] ) * 0.0702702703;",
			// "sum += texture2D( tDiffuse, vBlurCoords[1] ) * 0.3162162162;",
			// "sum += texture2D( tDiffuse, vBlurCoords[2] ) * 0.227027027;",
			// "sum += texture2D( tDiffuse, vBlurCoords[3] ) * 0.3162162162;",
			// "sum += texture2D( tDiffuse, vBlurCoords[4] ) * 0.0702702703;",

			"gl_FragColor = sum;",

		"}"

	].join("\n");

	var n = linear_weights.length * 2 - 1;

	var coords = [];
	var textures = [];
	
	for (var m = 0; m < n; m++) {
		o = m - linear_weights.length + 1;
		if (o < 0) {
			 coords.push("vBlurCoords[" + m + "] = uv3 - offset * " + toFloat(linear_offsets[-o]) + ";");

			 textures.push("sum += texture2D( tDiffuse, vBlurCoords[" + m + "] ) * "+ toFloat(linear_weights[-o]) + ";");
		} else {
			coords.push("vBlurCoords[" + m + "] = uv3 + offset * " + toFloat(linear_offsets[o]) + ";");

			textures.push("sum += texture2D( tDiffuse, vBlurCoords[" + m + "] ) * "+ toFloat(linear_weights[o]) + ";");
		}
	}

	vertexShader = vertexShader.replace(/%d/, n).replace(/%s/, coords.join('\n'));
	fragmentShader = fragmentShader.replace(/%d/, n).replace(/%s/, textures.join('\n'));

	// console.log(vertexShader);
	// console.log(fragmentShader);

	return {
		vertexShader: vertexShader,
		fragmentShader: fragmentShader
	};

}

function toFloat(n) {
	return n % 1 === 0 ? n.toFixed(1) : n;
}

/* Calculates and return binomial gaussian coefficients for linear sampling */
function calc( level ) {

	if ( level % 2 != 1 ) {
		console.log( 'odd number taps only ');
		return;
	}

	// Remove edges with too little weight.
	var edgesToRemove = 0;

	var binom = binomial( level );

	// console.log('Initial gaussian distribution', binom);

	var total = 0;
	for (var i = 0; i < binom.length; i++) {
		total += binom[ i ];
	}

	var weights = [];
	var offsets = [];
	var off = binom.length / 2 + 0.5;

	for (i = off - 1; i >= 0; i--) {
		weights.push( binom[i] / total );
		offsets.push( Math.abs(i + 1 - off));
	}

	// console.log('discrete weights', weights);
	// console.log('discrete offsets', offsets);

	
	/*
	// Edge removal requires more work with
	var weight = 1;

	while (edgesToRemove--) {
		weight -= weights.pop() * 2;
		offsets.pop();
	}

	for (i = 0; i < weights.length; i++) {
		weight[ i ] /= weight;
	}
	*/

	// Calculate linear sampling weights
	var linear_weights = [ weights[0] ];
	var linear_offsets = [ offsets[0] ];

	for (var t1 = 1; t1 < weights.length; t1+=2) {
		var t2 = t1 + 1;
		linear_weights.push(weights[t1] + weights[t2]);
		linear_offsets.push( (offsets[t1] * weights[t1] + offsets[t2] * weights[t2]) / linear_weights[linear_weights.length-1]);

	}

	// console.log('linear weights', linear_weights);
	// console.log('linear offsets', linear_offsets);

	return {
		weights: weights,
		offsets: offsets,
		linear_weights: linear_weights,
		linear_offsets: linear_offsets
	};
	
}

// Returns binomial sequence at level n.
// 1 - 1
// 2 - 1, 1
// 3 - 1, 2, 1
// 4 - 1, 3, 3, 1
function binomial( level ) {

	var previous = [1];

	for (var i = 1; i < level; i++) {
		var current = [ 1 ];

		for (var j = 0; j < previous.length-1; j++) {
			current.push( previous[j] + previous[j + 1] );
		}

		current.push( 1 );

		previous = current;

	}

	return previous;
	
}


CRAYON.extends( 'BlurNode', CRAYON.PostProcessNode, {

	init: function( renderer, repeats, downsample ) {

		var shader = generateShaders(9); // 13 17
		shader.uniforms = THREE.UniformsUtils.clone( THREE.BlurShader.uniforms );
		var vShaderMaterial = new THREE.ShaderMaterial( shader );

		shader = generateShaders(9);
		shader.uniforms = THREE.UniformsUtils.clone( THREE.BlurShader.uniforms );
		var hShaderMaterial = new THREE.ShaderMaterial( shader );

		CRAYON.PostProcessNode.call( this, renderer, vShaderMaterial );
		

		var resize = downsample || 1; // Down sample factor

		this.repeats = repeats || 1;


		var w = width / resize;
		var h = height / resize;

		this.renderTarget.width = w;
		this.renderTarget.height = h;
		this.renderTarget2 = this.renderTarget.clone();

		vShaderMaterial.uniforms.v.value =  1 / h;
		vShaderMaterial.uniforms.h.value =  0;

		hShaderMaterial.uniforms.v.value =  0;
		hShaderMaterial.uniforms.h.value =  1 / w;

		this.vShaderMaterial = vShaderMaterial;
		this.hShaderMaterial = hShaderMaterial;

		hShaderMaterial.uniforms.tDiffuse.value = this.renderTarget2;

		// this.quad.material = material;

		this.inputs.requires('tDiffuse');
	},

	render: function() {
		// Ping-pongs vertical and horizontal passes
		// TODO: build a buffered rendertarget object.

		var inRT = this.material.uniforms.tDiffuse.value;

		for (var i = 0; i < this.repeats; i++) {
			this.quad.material = this.vShaderMaterial;
			this.renderer.render( this.scene, this.camera, this.renderTarget2 );
			this.quad.material = this.hShaderMaterial;
			this.renderer.render( this.scene, this.camera, this.renderTarget );
			this.vShaderMaterial.uniforms.tDiffuse.value = this.renderTarget;
		}

		this.material.uniforms.tDiffuse.value = inRT;

	}

} );

/**
 * @author zz85 / http://www.lab4games.net/zz85/blog
 *
 * Two pass Gaussian blur filter (Run a vertical then horizontal blur passes)
 * - Related: http://www.gamerendering.com/2008/10/11/gaussian-blur-filter-shader/
 * - "h" and "v" parameters should be set to "1 / width" and "1 / height"
 *
 * Uses optimizations from
	 * http://rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling/
 * http://www.sunsetlakesoftware.com/2013/10/21/optimizing-gaussian-blurs-mobile-gpu
 * http://xissburg.com/faster-gaussian-blur-in-glsl/
 * https://github.com/manuelbua/blur-ninja
 */

THREE.BlurShader = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"h":        { type: "f", value: 1.0 / 512.0 },
		"v":        { type: "f", value: 1.0 / 512.0 }

	},

	vertexShader: [

		"uniform float h;",
		"uniform float v;",
		"varying vec2 vBlurCoords[5];",

		"void main() {",

			// "vUv = uv;",
			"vec2 uv3 = uv;",
			"vec2 offset = vec2(h, v);",
			"vBlurCoords[0] = uv3 + offset * -3.2307692308;",
			"vBlurCoords[1] = uv3 + offset * -1.3846153846;",
			"vBlurCoords[2] = uv3 ;",
			"vBlurCoords[3] = uv3 + offset * 1.3846153846;",
			"vBlurCoords[4] = uv3 + offset * 3.2307692308;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		
		"varying vec2 vBlurCoords[5];",

		"void main() {",

			"vec4 sum = vec4( 0.0 );",

			"sum += texture2D( tDiffuse, vBlurCoords[0] ) * 0.0702702703;",
			"sum += texture2D( tDiffuse, vBlurCoords[1] ) * 0.3162162162;",
			"sum += texture2D( tDiffuse, vBlurCoords[2] ) * 0.227027027;",
			"sum += texture2D( tDiffuse, vBlurCoords[3] ) * 0.3162162162;",
			"sum += texture2D( tDiffuse, vBlurCoords[4] ) * 0.0702702703;",

			"gl_FragColor = sum;",

		"}"

	].join("\n")

};