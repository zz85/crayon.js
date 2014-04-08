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