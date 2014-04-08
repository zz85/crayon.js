/*
 * Smart Shader Loader. Looks at 
 *	1. Shaders in JS code form
 *	2. Shaders in Script DOM Element
 *	3. Shaders as separate files
 *
 *	Should build a tool to compile 3 -> 1 for release versions
 */


function getShaderCode( name ) {

	if ( !window.CRAYON ) CRAYON = {};
	if ( !CRAYON.Shaders ) CRAYON.Shaders = {};

	if ( name in CRAYON.Shaders ) {

		return CRAYON.Shaders[ name ];

	}

	var script = document.getElementById( name );

	if ( script && script.textContent ) return script.textContent;

	var request = new XMLHttpRequest();
	request.open('GET', 'shaders/' + name + '.glsl', false);  // `false` makes the request synchronous
	request.send(null);

	if (request.status === 200) {

		var code = request.responseText;

		CRAYON.Shaders[ name ] = code; // Do simple caching

		return code;

	}

	console.log('Failed to load shader [' + name + ']');

}

function dumpShaderCode() {

	console.log( 'CRAYON.Shaders=' + JSON.stringify(CRAYON.Shaders) )

}


// GLSL Error Helper by @thespite https://gist.github.com/spite/ec45430b585089fe3ace

( function() {

	var context = 1, c; // lines before and after error
	var SPEECH = false;
 
	function _h( f, c ) {
		return function() {
			var res = f.apply( this, arguments );
			c.apply( this, arguments );
			return res;
		}
	}
 
	function processErrors( errors, source ) {
 
		var css = '#shaderReport{ box-sizing: border-box; position: absolute; left: 0; top: 0; \
			right: 0; font-family: monaco, monospace; font-size: 12px; z-index: 1000; \
			background-color: #b70000; color: #ffffff; white-space: normal; \
			text-shadow: 0 -1px 0 rgba(0,0,0,.6); line-height: 1.2em; list-style-type: none; \
			padding: 0; margin: 0; max-height: 300px; overflow: auto; } \
			#shaderReport li{ padding: 10px; border-top: 1px solid rgba( 255, 255, 255, .2 ); \
			border-bottom: 1px solid rgba( 0, 0, 0, .2 ) } \
			#shaderReport li p{ padding: 0; margin: 0 } \
			#shaderReport li:nth-child(odd){ background-color: #c9542b }\
			#shaderReport li p:first-child{ color: #eee }';
 
		var el = document.createElement( 'style' );
		document.getElementsByTagName( 'head' )[ 0 ].appendChild( el );
		el.textContent = css;
 
		var report = document.createElement( 'ul' );
		report.setAttribute( 'id', 'shaderReport' );
		document.body.appendChild( report );
 
		var re = /ERROR: [\d]+:([\d]+): (.+)/gmi; 
		var lines = source.split( '\n' );
 
		var m, c;
		while ((m = re.exec( errors )) != null) {
			if (m.index === re.lastIndex) {
				re.lastIndex++;
			}
			var li = document.createElement( 'li' );
			var line = +m[ 1 ];
			var code = '<p>ERROR "<b>' + m[ 2 ] + '</b>" in line ' + line + '</p>';
			code += '<pre style="text-align: left;">';
			for (c = context; c > 0; c--) {
				code += '<p style="color:#999">' + lines[ line - 1 - c ].replace( /^[ \t]+/g, '' ) + '</p>';
			}
			code += '<p>' + lines[ line - 1 ].replace( /^[ \t]+/g, '' ) + '</p>';
			for (c = 0; c < context; c++) {
				code += '<p style="color:#999">' + lines[ line + c ].replace( /^[ \t]+/g, '' ) + '</p>';
			}
			code += '</pre>';

			li.innerHTML = code;
			report.appendChild( li );

			if (SPEECH) {
				// Requires Google Chrome Canary + experimental WebKit features
				var speech = new SpeechSynthesisUtterance();
				speech.text = "Error on line " + line;
				window.speechSynthesis.speak(speech);
			}

		}
		
	}
 
	WebGLRenderingContext.prototype.compileShader = _h( 
		WebGLRenderingContext.prototype.compileShader, 
		function( shader ) {
 
			if ( !this.getShaderParameter( shader, this.COMPILE_STATUS ) ) {
 
				var errors = this.getShaderInfoLog( shader );
				var source = this.getShaderSource( shader );
 
				processErrors( errors, source );
 
			}
		} 
	);
 
} )();


function ajax(url, callback) {
	var xhr = new XMLHttpRequest();

	xhr.onreadystatechange = function () {

		if ( xhr.readyState == 4 ) {

			if ( xhr.status == 200 || xhr.status == 0 ) {

				callback(xhr.responseText);

			} else {

				console.error( "Couldn't load [" + url + "] [" + xhr.status + "]" );

			}

		}

	};

	xhr.open( "GET", url, true );
	xhr.send( null );
}
