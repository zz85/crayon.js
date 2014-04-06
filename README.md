crayon.js
=========

A Node-based Shader Library for Three.js

Sample Code

```
	// Init Shader Nodes
	sceneNode = new SceneNode();
	sceneDepthNode = new SceneDepthNode( sceneNode );
	edgeNode = new EdgeFilterNode( renderer );
	screenNode = new RenderToScreenNode( renderer );
	multiplyNode = new MultiplyNode( renderer );
	
	// Connect the nodes
	sceneNode.connect( sceneDepthNode ); // For depth
	sceneDepthNode.connect(edgeNode, 'texture') // For applying sobel edge filter
	edgeNode.connect(multiplyNode, 'texture1') // MultipleNode takes in first texture from outlines
	sceneNode.connect(multiplyNode, 'texture2') // MultipleNode takes in 2nd texture from the scene
	multiplyNode.connect(screenNode, 'texture'); // Renders multiple operator to screen
	
	// In the render loop
	screenNode.renderAll(); // Calculates all node dependencies, execute them and render to screen
	
```

##Q&A
_Why is this called Crayon?_

1. I think we started drawing with crayon when we were kids. I hope this library is akin to digitial crayons, where I start to explore creating beautiful drawing and paintings.
2. This library was created to help myself when I decided to work on some NPR (Non-Photorealistic Rendering) experiments eg. pencil, toon, watercolor shadings. Perhaps, I might be able to create an interactive crayon shader one day.

_Is this yet another post-processing / shader library?_

Well kinda. Not that I think writing my own code is the the best, but...

* It started from wanting to scratch my own itch
* Because I wanted to explore writing some NPR filters which are slightly more complex,
* I wanted to ease the pain working on post-processing with three.js
* I thought a Node-based approach is the way to go. (Akin to WebAudioAPI, Quartz Composer. Perhaps one day I'll build a node base UI for this as well)
* I'm experimenting and learning on the way

Just in case you're looking for related node-based / post-processing stuff
* Three.js examples uses EffectComposer by @alteredq. They come right out of the box with three.js
* @thespite is working on [Wagner](https://github.com/spite/Wagner), his improved version of EffectComposer
* [ShaderGraph](https://github.com/unconed/ShaderGraph.js) by Unconed. Pretty much uses a node based approach, and is used to power [MathBox](https://github.com/unconed/MathBox.js/).
* [PP.js](https://github.com/rdad/PP.js/) also a post-processing library for three.js with a fluent-style api.
* [Seriously.js](https://github.com/brianchirls/Seriously.js/) Node based compositor for videos with WebGL. 
* [ThreeNodes.js](http://idflood.github.io/ThreeNodes.js/) A web-based Visual Node-base system for Three.js
