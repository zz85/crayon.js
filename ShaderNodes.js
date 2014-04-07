var width = innerWidth;
var height = innerHeight;

/*********************************************************************/

// A Shader Node has a render target and a render/pass/run/update function

function ShaderNode() {

	var renderTarget;

	var parameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};

	renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );
	
	this.renderTarget = renderTarget;

	this.inputs = new InputConnector( this );
	
	// .reinit() / resize()
}

ShaderNode.prototype.render = function() {
	console.warn('ShaderNode.render() should be extended');
}

ShaderNode.prototype.connect = function(target, name) {
	// name = 'texture';
	target.inputs.link(this, name);
	// TODO: Keep a list of connected Nodes

}

// Post Process Node uses a shader material
function PostProcessNode(renderer, material) {
	ShaderNode.call( this )

	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	this.quad = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), null );
	this.scene = new THREE.Scene();
	this.scene.add( this.quad );
	this.renderer = renderer;

	this.material = material;
	this.quad.material = material;

}

Extends('PostProcessNode', ShaderNode);

PostProcessNode.prototype.render = function() {
	// this.renderer.clear();
	this.renderer.render( this.scene, this.camera, this.renderTarget );
}

function InputConnector(node) {
	this.requirements = [];
	this.connectedFrom = {};
	this.node = node;
}

InputConnector.prototype.requires = function() {
	this.requirements = Array.prototype.slice.call(arguments);	
}


InputConnector.prototype.link = function(from, name) {
	this.connectedFrom[name] = from;
	if (this.node instanceof PostProcessNode) {
		if (!(name in this.node.material.uniforms)) {
			// Sanity check for target uniform, else warn
			console.log('No uniform found' + name)
		}
		this.node.material.uniforms[name].value = from.renderTarget;
	} else {
		// Support for non-render nodes?
		// console.log('Not linking textures', from.name, name)

		// 
	}
}

InputConnector.prototype.preRenderCheck = function(visited) {
	// Depth first dependency checking.
	// See http://en.wikipedia.org/wiki/Topological_sorting#Algorithms

	if (!visited) visited = [];

	var names = this.requirements, name, node;

	if (this.checked) {
		console.log('preRenderCheck already ran');
		return visited;
	}
	this.checked = false; // or could use index of for checking.

	if (names.length != 0)  {
		for (var i=0; i < names.length; i++) {
			name = names[i];
			node = this.connectedFrom[name];

			if (!node) {
				console.warn(this.node.name + ' has missing Input Node ["' + name +  '"]');
			} else {
				if (!node.inputs.checked) {
					node.inputs.preRenderCheck(visited);
				}
			}
		}
	}

	visited.push( this.node );
	this.checked = true;
	return visited;
}

function RenderToScreenNode( renderer ) {

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
		vertexShader:   getScriptShader('vsPass'),
		fragmentShader: getScriptShader('fsPass')
	});

	
	PostProcessNode.call( this, renderer, shaderMaterial );
	this.inputs.requires('texture', 'gradientX', 'gradientY', 'edge');

}

Extends('RenderToScreenNode', PostProcessNode);

RenderToScreenNode.prototype.render = function() {
	// this.renderer.clear();
	this.renderer.render( this.scene, this.camera );
}

RenderToScreenNode.prototype.renderAll = function() {
	
	if (!this.nodesToRender) {
		this.nodesToRender = this.inputs.preRenderCheck();
		console.log('Lists of nodes to render', this.nodesToRender);
	}

	var nodesToRender = this.nodesToRender;

	for (var i=0; i<nodesToRender.length; i++) {
		var node = nodesToRender[i];
		node.render();
	}
}			

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


function EdgeFilterNode() {

	var shaderMaterial = new THREE.ShaderMaterial( THREE.EdgeShader2 );
	shaderMaterial.uniforms.resolution.value.set( width / 2, height / 2 );

	PostProcessNode.call( this, renderer, shaderMaterial );
	this.renderTarget.width = width / 2;
	this.renderTarget.height = height / 2;
	this.inputs.requires('texture');

}

Extends('EdgeFilterNode', PostProcessNode);


// EdgeFilterNode.prototype = Object.create( PostProcessNode.prototype );

function Extends(name, parent) {
	window[name].prototype = Object.create( parent.prototype );
	window[name].prototype.name = name;
	// window[name] = function() {
	// 	init();
	// }
}



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


function MultiplyNode() {

	var shaderMaterial = new THREE.ShaderMaterial( THREE.MultiplyNode );
	shaderMaterial.uniforms.resolution.value.set( width, height );

	PostProcessNode.call( this, renderer, shaderMaterial );
	this.inputs.requires('texture1', 'texture2');

}
Extends('MultiplyNode', PostProcessNode);

function SceneNode() {

	ShaderNode.call( this );
	// Renders scene to Render Target				
	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
	// camera.position.z = 400;

	camera.position.y = 150;
	camera.position.z = 500;


	scene = new THREE.Scene();
	renderer.setClearColor( 0xffffff );

	var geometry = new THREE.CubeGeometry( 200, 200, 200 );

	material_depth = new THREE.MeshDepthMaterial();
	

	function phongMaterial(ambient, diffuse, shiny, power) {
		return new THREE.MeshPhongMaterial({
			emissive : ambient,
			color    : diffuse,
			specular : shiny,
			shininess: power
		});
	}

	function directionalLight(x, y, z, color) {
		var light = new THREE.DirectionalLight(color);
		light.position.set(x,y,z).normalize();
		return light;
	}

	var material = new THREE.MeshBasicMaterial( { // MeshPhongMaterial MeshLambertMaterial
		color: 0xfa9204, 
		// shading: THREE.FlatShading
	} );


	// material = phongMaterial(0x333333, 0xfa9204, 0xffffff, 30)
	// scene.add(new THREE.AmbientLight(0x333333));
	scene.add(directionalLight(.2,0,1, 0xffffff));


	cube = new THREE.Mesh( geometry, material );
	scene.add( cube );

	// var geometry = new THREE.TorusKnotGeometry( 150 );
	// for ( var i = 0, j = geometry.faces.length; i < j; i ++ ) {

	// 	geometry.faces[ i ].color.setHex( Math.random() * 0xffffff );

	// }
	// torus = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: 0x0000ff, vertexColors: THREE.FaceColors } ) );

	// scene.add( torus );

	// new THREE.MeshLambertMaterial( { shading: THREE.FlatShading } )


	sphere = new THREE.Mesh( new THREE.SphereGeometry( 200, 20, 10 ), material );
	sphere.position.z = -200;

	sphere2 = new THREE.Mesh( new THREE.SphereGeometry( 100, 20, 10 ), material );
	sphere2.position.set(200, 0, -40);

	scene.add( sphere );
	scene.add( sphere2 );



	var material = new THREE.MeshBasicMaterial( { color: 0xe0e0e0 } );

	plane = new THREE.Mesh( geometry, material );
	plane.position.y = - 200;
	plane.rotation.x = - Math.PI / 2;
	scene.add( plane );


	

}

Extends('SceneNode', ShaderNode);

SceneNode.prototype.render = function() {

	var timer = Date.now();

	cube.rotation.y = timer * 0.0005;

	sphere.position.y = Math.abs( Math.sin( timer * 0.002 ) ) * 150;
	sphere.rotation.x = timer * 0.0003;
	sphere.rotation.z = timer * 0.0002;

	sphere2.position.y = Math.abs( Math.sin( timer * 0.004 ) ) * 100;
	sphere2.rotation.x = timer * 0.0013;
	sphere2.rotation.z = timer * 0.0002;


	// mesh.rotation.x += 0.005;
	// mesh.rotation.y += 0.01;

	renderer.render( scene, camera, this.renderTarget );
}

function SceneDepthNode( sceneNode ) {
	ShaderNode.call( this );

	this.sceneNode = sceneNode;
	this.inputs.requires('fake')

}

Extends('SceneDepthNode', ShaderNode);

SceneDepthNode.prototype.render = function() {

	scene.overrideMaterial = material_depth;
	
	renderer.render( scene, camera, this.renderTarget );

	scene.overrideMaterial = null;
}





function GradientEncoderNode( previousNode, top ) {

	var shaderMaterial = new THREE.ShaderMaterial( {
		uniforms: 		{
			texture: { type: 't', value: null },
			resolution: { type: 'v2', value: new THREE.Vector2(width, height) },
			top: { type: 'f', value: top }
		},
		attributes:     {},
		vertexShader:   getScriptShader('vsPass'),
		fragmentShader: getScriptShader('fsGradientEncode')
	});

	PostProcessNode.call( this, renderer, shaderMaterial );
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

}

Extends('GradientEncoderNode', PostProcessNode);

GradientEncoderNode.prototype.render = function() {
	console.log('float!!!')
	
	this.renderer.render( this.scene, this.camera, this.encodedRenderTarget );
	// renderer.render( this.scene, this.camera, this.renderTarget );
	var gl = renderer.getContext();
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);

}

//---------------


function FloatEncoderNode( previousNode ) {

	var shaderMaterial = new THREE.ShaderMaterial( {
		uniforms: 		{
			texture: { type: 't', value: null },
			resolution: { type: 'v2', value: new THREE.Vector2(width, height) }
		},
		attributes:     {},
		vertexShader:   getScriptShader('vsPass'),
		fragmentShader: getScriptShader('fsEncodeFloatX')
	});

	PostProcessNode.call( this, renderer, shaderMaterial );
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

}

Extends('FloatEncoderNode', PostProcessNode);

FloatEncoderNode.prototype.render = function() {

	this.renderer.render( this.scene, this.camera, this.encodedRenderTarget );
	// renderer.render( this.scene, this.camera, this.renderTarget );
	var gl = renderer.getContext();
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);

}


// function ParticleRendererNode( sceneNode ) {
// 	ShaderNode.call( this );
// }

// Extends('ParticleRendererNode', ShaderNode);

// ParticleRendererNode.prototype.render = function() {

// 	scene.overrideMaterial = material_depth;
	
// 	renderer.render( scene, camera, this.renderTarget );

// 	scene.overrideMaterial = null;
// }






/*********************************************************************/