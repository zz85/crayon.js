CRAYON.extends( 'ParticleRendererNode', CRAYON.PostProcessNode, {

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

		geometry.addAttribute( 'position', Float32Array, PARTICLES, 3 );
		geometry.addAttribute( 'size', Float32Array, PARTICLES, 1 );

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

} );