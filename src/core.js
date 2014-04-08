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

		this.connectedFrom[name] = from;

		if ( this.node instanceof CRAYON.ExecutorNode ) {

		} else if ( this.node instanceof CRAYON.PostProcessNode ) {
			
			if ( ! ( name in this.node.material.uniforms ) ) {
				// Sanity check for target uniform, else warn
				console.log('No uniform found' + name);
			}

			this.node.material.uniforms[name].value = from.renderTarget;

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
