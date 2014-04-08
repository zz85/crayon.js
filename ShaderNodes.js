/*
 *  crayon.js
 *  @author zz85 / https://github.com/zz85
 *
 */

window.CRAYON = {

	extends: function( name, parent, props ) {

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
	}
};

var width = innerWidth;
var height = innerHeight;

/*********************************************************************/


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

		CRAYON.ShaderNode.call( this )

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

		this.connectedFrom[name] = from;

		if ( this.node instanceof CRAYON.ExecutorNode ) {

		} else if ( this.node instanceof CRAYON.PostProcessNode ) {
			
			if ( ! ( name in this.node.material.uniforms ) ) {
				// Sanity check for target uniform, else warn
				console.log('No uniform found' + name)
			}

			this.node.material.uniforms[name].value = from.renderTarget;

		} else {
			// Support for non-render nodes?
			console.log('Not linking textures', from.name, name)

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
		this.inputs.requires('texture', 'gradientX', 'gradientY', 'edge');

	},

	render: function() {

		// this.renderAll();

	},

	renderAll: function() {
		
		if (!this.nodesToRender) {

			this.nodesToRender = this.inputs.getDependencies();

			console.log('Lists of nodes to render' );
			// this.nodesToRender.forEach(function(a) {console.log(a.name)})
			
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

				// Fakes
				edge: { type: 't', value: null },
				gradientY: { type: 't', value: null },
				gradientX: { type: 't', value: null },

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
			

			"gl_FragColor = vec4((1. - (1. - c1) * (1. - c2)), 1.0);",
			// "gl_FragColor = vec4(c1 * c2, 1.0);",
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

		this.sceneNode = sceneNode;
		this.inputs.requires('fake')

	},

	render: function() {

		scene.overrideMaterial = material_depth;
		
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
		this.inputs.requires('texture')

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
		console.log('float!!!')
		
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
		this.inputs.requires('texture')

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
		this.renderTarget = this.encodedRenderTarget

	},

	render: function() {

		this.renderer.render( this.scene, this.camera, this.encodedRenderTarget );
		// renderer.render( this.scene, this.camera, this.renderTarget );
		var gl = renderer.getContext();
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);

	}

} );




/*********************************************************************/