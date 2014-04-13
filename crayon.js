/*
 *  crayon.js
 *  @author zz85 / https://github.com/zz85
 *
 */

if (!window.CRAYON) CRAYON = {};

CRAYON.extends = function( name, parent, props ) {

	var klass = props.init;
	klass.prototype = Object.create( parent.prototype );
	klass.prototype.name = name;
	klass.prototype.super = parent.prototype;


	for ( var n in props ) {

		if ( n != 'init') {
			klass.prototype[ n ] = props[ n ];
		}

	}

	this[ name ] = klass;
};


var width = innerWidth;
var height = innerHeight;




CRAYON.extends( 'Node', Object, {

	init: function() {

		this.inputs = new CRAYON.InputConnector( this );
		this.outputs = [];
	},

	render: function() { // TODO: Rename to execute / update?

		console.warn( 'Please extend ' + this.name + '.render()' );

	},

	connect: function( target, name ) {
		// TODO: use a default name of 'texture'?
		target.inputs.link(this, name);
		// TODO: keep a reference to connected nodes here?
		
	}

} );

// A Shader Node has a render target and a render/pass/run/update function

CRAYON.extends( 'ShaderNode', CRAYON.Node, {

	init: function() {

		var renderTarget;

		var parameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBFormat,
			stencilBuffer: false
		};

		renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
		
		this.renderTarget = renderTarget;

		CRAYON.Node.call( this );
		
	},

	setSize: function( width, height ) { // TODO resizing to be worked on

		var rt = this.renderTarget.clone();
		rt.width = width;
		rt.height = height;
		this.renderTarget = rt;

	}

});


// Post Process Node uses a shader material
CRAYON.extends( 'PostProcessNode', CRAYON.ShaderNode, {

	init: function ( renderer, material ) { // TODO parameters to be worked on

		CRAYON.ShaderNode.call( this );

		this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 10000 );

		this.quad = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), null );
		this.scene = new THREE.Scene();
		this.scene.add( this.quad );
		this.renderer = renderer;

		this.material = material;
		this.quad.material = material;

	},

	render: function() {
		// this.renderer.clear();
		this.renderer.render( this.scene, this.camera, this.renderTarget );
	}


} );

CRAYON.extends( 'InputConnector', Object, {

	init: function( node ) {

		this.requirements = [];
		this.connectedFrom = {};
		this.node = node;
		
	},

	requires: function() {

		this.requirements = Array.prototype.slice.call(arguments);	

	},

	link: function( from, name ) {

		// TODO Make this cleaner

		if (!name) {
			if (this.requirements.length == 1) {
				name = this.requirements[0];
			}
		}

		this.connectedFrom[name] = from;

		if ( this.node instanceof CRAYON.ExecutorNode ) {

		} else if ( this.node instanceof CRAYON.PostProcessNode ) {
			
			if ( ! ( name in this.node.material.uniforms ) ) {
				// Sanity check for target uniform, else warn
				console.log('No uniform found' + name);
			}

			this.node.material.uniforms[name].value = from.renderTarget;
			// this.node.incomingRT


		} else {
			// Support for non-render nodes?
			console.log('Not linking textures', from.name, name);

			// 
		}
	},

	list: function() {
		console.log( this.requirements );
	},

	getDependencies: function( visited ) {
		// Depth first dependency checking.
		// See http://en.wikipedia.org/wiki/Topological_sorting#Algorithms

		if ( !visited ) visited = [];

		var names = this.requirements, name, node;

		if ( visited.indexOf( this.node ) > -1 ) {

			console.log('getDependencies already ran');
			return visited;

		}

		if ( this.node instanceof CRAYON.ExecutorNode ) { // wildcard
			console.log('fdfd');

			for (name in this.connectedFrom) {

				node = this.connectedFrom[name];

				if (!node) {

					if (! (this.node instanceof CRAYON.ExecutorNode) )
					console.warn(this.node.name + ' has missing Input Node ["' + name +  '"]');

				} else {

					if ( visited.indexOf( node ) == -1 ) {

						node.inputs.getDependencies( visited );

					}
				}
			}

		} else

		for ( var i=0; i < names.length; i++ ) {

			name = names[i];
			node = this.connectedFrom[name];

			if (!node) {

				if (! (this.node instanceof CRAYON.ExecutorNode) )
				console.warn(this.node.name + ' has missing Input Node ["' + name +  '"]');

			} else {

				if ( visited.indexOf( node ) == -1 ) {

					node.inputs.getDependencies( visited );

				}
			}
		}

		visited.push( this.node );

		return visited;
	}

} );

/*
 * Executor Node.
 *	Endpoint of graphs should lead to an executor node
 */

CRAYON.extends( 'ExecutorNode', CRAYON.ShaderNode, {

	init: function ( renderer ) {

		CRAYON.ShaderNode.call( this, renderer );
		this.inputs.requires('texture');
		// , 'gradientX', 'gradientY', 'edge'

	},

	render: function() {

		// this.renderAll();

	},

	renderAll: function() {
		
		if (!this.nodesToRender) {

			this.nodesToRender = this.inputs.getDependencies();

			console.log('Lists of nodes to render' );
			this.nodesToRender.forEach(function(a) {console.log(a.name);});
			
		}

		var nodesToRender = this.nodesToRender;

		if (nodesToRender.length == 1) console.warn('ExecutorNode has nothing to execute');

		for (var i=0; i<nodesToRender.length; i++) {
			var node = nodesToRender[i];

			// console.log(node.name);

			node.render();

		}
	}


} );


CRAYON.extends( 'RenderToScreenNode', CRAYON.PostProcessNode, {

	init: function ( renderer ) {

		var shaderMaterial = new THREE.ShaderMaterial( {
			uniforms: 		{
				texture: { type: 't', value: null },
				resolution: { type: 'v2', value: new THREE.Vector2(width, height) }
			},
			attributes:     {},
			vertexShader:   getShaderCode('pass-vs'),
			fragmentShader: getShaderCode('pass-fs')
		});

		
		CRAYON.PostProcessNode.call( this, renderer, shaderMaterial );
		this.inputs.requires('texture');

	},

	render: function() {
		// this.renderer.clear();
		this.renderer.render( this.scene, this.camera );
	}

} );
;/*
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

	console.log(vertexShader);
	console.log(fragmentShader);

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

		console.log(this);

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

};;CRAYON.extends( 'ParticleRendererNode', CRAYON.PostProcessNode, {

	init: function( renderer ) {
		

		var attributes = {

			size: {	type: 'f', value: null },

		};

		var texture = THREE.ImageUtils.loadTexture( "textures/circle.png" );  // spark1.png circle.png snowflake7_alpha.png

		var uniforms = {

			time: { type: "f", value: 1.0 },
			brush:   { type: "t", value: texture },
			texture:   { type: "t", value: null },
			color:   { type: "t", value: null },

		};

		this.uniforms = uniforms;

		var material = new THREE.ShaderMaterial( {

			uniforms: 		uniforms,
			attributes:     attributes,
			vertexShader:   document.getElementById( 'particle-brush-vs' ).textContent,
			fragmentShader: document.getElementById( 'particle-brush-fs' ).textContent,

			blending: 		THREE.AdditiveBlending,
			depthTest: 		false,
			depthWrite:     false,
			transparent:	true

		});

		

		CRAYON.PostProcessNode.call( this, renderer, material );

		this.scene.remove( this.quad );

		var PARTICLES = 500000; // 100000;
		//

		var geometry = new THREE.BufferGeometry();

		geometry.addAttribute( 'position', new THREE.Float32Attribute( PARTICLES, 3 ) );
		geometry.addAttribute( 'size', new THREE.Float32Attribute( PARTICLES, 1 ) );

		var positions = geometry.attributes.position.array;
		var size = geometry.attributes.size.array;

		for ( var i = 0; i < positions.length; i += 3 ) {

			// positions

			var x = Math.random() * 2 - 1; // -1 .. +1
			var y = Math.random() * 2 - 1;

			positions[ i ]     = x ;
			positions[ i + 1 ] = y ;
			positions[ i + 2 ] = 0 ;

			// width / 500 
			size[i] = 0.4 * (Math.random() * 4 + 8);

		}

		geometry.computeBoundingSphere();

		//

		var particleSystem = new THREE.ParticleSystem( geometry, material );
		this.scene.add( particleSystem );

		this.inputs.requires('texture');
	},

	render: function() {

		this.uniforms.time.value = performance.now();

		CRAYON.PostProcessNode.prototype.render.call( this );


	}

} );;

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