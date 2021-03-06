/*!
 * The Word Search Game Widget
 *
 * Copyright 2011, Ryan Fernandes (https://code.google.com/u/@VBFTRFJWDxFDXgJ4/)
 * Licensed under The MIT License.
 * see license.txt
 *
 */

//==============================================================================
//------------------------------------------------------------------------------  
//The Word Search Game Widget
//------------------------------------------------------------------------------  
//  
//  ------
//  Usage:
//  ------
//      $(document).ready( function () {
//      var words = "earth,mars,mercury,neptune,pluto,saturn,jupiter,one,two,
//              three,four,five,six,seven,eight,mozart,bach,meyer,rose,mahler";
//      $("#theGrid").wordsearchwidget({"wordlist" : words,"gridsize" : 12, 
//      onWordFound: function(object){
//      alert(object.word);
//      },
//      onWordSearchComplete: function(){
//          alert("Game over");
//      }
//      });
//      });
//  
//  -------
//  Inputs: 
//  -------
//  gridsize - Size of grid to generate (this will be a square)
//  wordlist - Comma separated list of words to place on the grid
//  
//  -------------
//  What it does:               
//  -------------
//  Creates a grid of letters with words from the wordlist
//  These words are randomly placed in the following directions
//  1. Horizontal
//  2. Vertical
//  3. Left-Diagonal
//  4. Right-Diagonal
//  In addition, the letters are placed in forward or reverse order, randomly
//  Provision is made to overlap words
//  
//  The User is expected to click on a letter and drag to the last letter of the 
//  word. If the selected letters form a word that is in the word list the UI
//  will indicate that by crossing it out from the wordlist
//  
//  If the user cannot find a word, she has to click on that word in the 
//  wordlist and the UI will hightlight the word in the grid and cross it out
//  
//  ------------------
//  Technical Details:
//  ------------------ 
//  
//      Contains 3 areas: 
//          a) main game grid (#rf-searchgamecontainer)
//          b) list of words to be found (#rf-wordcontainer)
//          c) list of words that have been found (#rf-foundwordcontainer)
//      
//      Data Structures used:
//      ---------------------
//          Objects related to the Data Model
//          0) Model
//              a) Grid
//                  1) Cell
//                  2) HorizontalPopulator
//                  3) VerticalPopulator
//                  4) LeftDiagonalPopulator
//                  5) RightDiagonalPopulator
//                  
//              b) WordList
//                  1) Word
//          
//          Objects related to View
//          1) Root
//          2) Hotzone
//          3) Arms
//          4) Visualizer
//          
//          Objects related to the controller
//          1) GameWidgetHelper         
//          
//  
//  -------
//  Events: 
//  -------     
//  onWordFound:
//      This event is called whenever a user finds a word in the list. The function passes an object with two properties:
//          id: The index of the word in the list
//          word: The name of the word found.
//
//  onWordSearchComplete:
//      This event is called when all the words in the list have been found and the game ends.
//==============================================================================

(function($, undefined) {

    var currentWord = 0;
    var maxWords = 0;
    var encontrePalabra = undefined;
    var cuandoEncuentreTodas = undefined;
    $.widget("ryanf.wordsearchwidget", $.ui.mouse, {

        options: {
            wordlist: null,
            gridsize: 10,
            onWordFound: undefined,
            onWordSearchComplete: undefined
        },

        _create: function() {
            //member variables
            this.model = GameWidgetHelper.prepGrid(this.options.gridsize, this.options.wordlist)
            this.startedAt = new Root();
            this.hotzone = new Hotzone();
            this.arms = new Arms();

            encontrePalabra = this.options.onWordFound;
            cuandoEncuentreTodas = this.options.onWordSearchComplete;
            maxWords = this.options.wordlist.split(",").length;

            GameWidgetHelper.renderGame(this.element[0], this.model);

            this.options.distance = 0; // set mouse option property
            this._mouseInit();


        }, //_create

        destroy: function() {

            this.hotzone.clean();
            this.arms.clean();
            this.startedAt.clean();

            this._mouseDestroy();
            return this;

        },

        //mouse callbacks
        _mouseStart: function(event) {

            var panel = $(event.target).parents("div").attr("id");
            if (panel == 'rf-searchgamecontainer') {
                this.startedAt.setRoot(event.target);
                this.hotzone.createZone(event.target)
            } else if (panel == 'rf-wordcontainer') {
                //User has requested help. Identify the word on the grid
                //We have a reference to the td in the cells that make up this word
                var idx = $(event.target).parent().children().index(event.target);

                var selectedWord = this.model.wordList.get(idx);
                $(selectedWord.cellsUsed).each(function() {
                    Visualizer.highlight($(this.td));
                });

            }

        },

        _mouseDrag: function(event) {

            //if this.root - clear out everything and return to orignal clicked state
            if (this.startedAt.isSameCell(event.target)) {
                this.arms.returnToNormal();
                this.hotzone.setChosen(-1);
                return;
            }

            //if event is on an armed cell
            if ($(event.target).hasClass("rf-armed") || $(event.target).hasClass("rf-glowing")) { //CHANGE! 

                //if in hotzone
                var chosenOne = this.hotzone.index(event.target);
                if (chosenOne != -1) {
                    //set target to glowing; set rest of hotzone to armed
                    this.hotzone.setChosen(chosenOne);

                    //calculate arms and set to armed
                    this.arms.deduceArm(this.startedAt.root, chosenOne);


                } else { //in arms
                    //set glowing from target to root
                    this.arms.glowTo(event.target)
                }
            }

        },

        _mouseStop: function(event) {

            //get word
            var selectedword = '';
            $('.rf-glowing, .rf-highlight', this.element[0]).each(function() {
                var u = $.data(this, "cell");
                selectedword += u.value;
            });

            var wordIndex = this.model.wordList.isWordPresent(selectedword)
            if (wordIndex != -1) {
                $('.rf-glowing, .rf-highlight', this.element[0]).each(function() {
                    Visualizer.select(this);
                    $.data(this, "selected", "true");

                });
                GameWidgetHelper.signalWordFound(wordIndex);
            }

            this.hotzone.returnToNormal();
            this.startedAt.returnToNormal();
            this.arms.returnToNormal();
        }

    }); //widget


    $.extend($.ryanf.wordsearchwidget, {
        version: "0.0.1"
    });

    //------------------------------------------------------------------------------
    // VIEW OBJECTS 
    //------------------------------------------------------------------------------
    /*
     * The Arms represent the cells that are selectable once the hotzone has been 
     * exited/passed
     */
    function Arms() {
        this.arms = null;

        //deduces the arm based on the cell from which it exited the hotzone.
        this.deduceArm = function(root, idx) {

            this.returnToNormal(); //clear old arm
            var ix = $(root).parent().children().index(root);

            //create the new nominees
            this.arms = new Array();

            //create surrounding nominees
            switch (idx) {
                case 0: //horizontal left
                    this.arms = $(root).prevAll();
                    break;

                case 1: //horizontal right
                    this.arms = $(root).nextAll();
                    break;

                case 2: //vertical top
                    var $n = this.arms;
                    $(root).parent().prevAll().each(function() {
                        $n.push($(this).children().get(ix));
                    });

                    break;

                case 3: //vertical bottom
                    var $o = this.arms;
                    $(root).parent().nextAll().each(function() {
                        $o.push($(this).children().get(ix));
                    });
                    break;

                case 4: //right diagonal up

                    var $p = this.arms;

                    //for all prevAll rows
                    var currix = ix;
                    $(root).parent().prevAll().each(function() {
                        $p.push($(this).children().get(++currix));
                    });
                    break;

                case 5: //left diagonal up
                    var $q = this.arms;

                    //for all prevAll rows
                    var currixq = ix;
                    $(root).parent().prevAll().each(function() {
                        $q.push($(this).children().get(--currixq));
                    });
                    break;

                case 6: //left diagonal down
                    var $r = this.arms;
                    //for all nextAll rows
                    var currixr = ix;
                    $(root).parent().nextAll().each(function() {
                        $r.push($(this).children().get(++currixr));
                    });
                    break;

                case 7: //right diagonal down
                    var $s = this.arms;
                    //for all nextAll rows
                    var currixs = ix;
                    $(root).parent().nextAll().each(function() {
                        $s.push($(this).children().get(--currixs));
                    });
                    break;


            }
            for (var x = 1; x < this.arms.length; x++) {
                Visualizer.arm(this.arms[x]);
            }
        }

        //lights up the cells that from the root cell tothe current one
        this.glowTo = function(upto) {
            var to = $(this.arms).index(upto);

            for (var x = 1; x < this.arms.length; x++) {

                if (x <= to) {
                    Visualizer.glow(this.arms[x]);
                } else {
                    Visualizer.arm(this.arms[x]);

                }
            }
        }

        //clear out the arms 
        this.returnToNormal = function() {
            if (!this.arms) return;

            for (var t = 1; t < this.arms.length; t++) { //don't clear the hotzone
                Visualizer.restore(this.arms[t]);
            }
        }


        this.clean = function() {
            $(this.arms).each(function() {
                Visualizer.clean(this);
            });
        }

    }

    /*
     * Object that represents the cells that are selectable around the root cell
     */
    function Hotzone() {

        this.elems = null;

        //define the hotzone
        //select all neighboring cells as nominees
        this.createZone = function(root) {
                this.elems = new Array();

                var $tgt = $(root);
                var ix = $tgt.parent().children().index($tgt);

                var above = $tgt.parent().prev().children().get(ix); // above
                var below = $tgt.parent().next().children().get(ix); // below

                //nominatedCells.push(event.target); // self
                this.elems.push($tgt.prev()[0], $tgt.next()[0]); //horizontal
                this.elems.push(above, below,
                    $(above).next()[0], $(above).prev()[0], //diagonal
                    $(below).next()[0], $(below).prev()[0] //diagonal
                );


                $(this.elems).each(function() {
                    if ($(this) != null) {
                        Visualizer.arm(this);
                    }
                });

            }
            //give the hotzone some intelligence
        this.index = function(elm) {
            return $(this.elems).index(elm);
        }

        this.setChosen = function(chosenOne) {
            for (var x = 0; x < this.elems.length; x++) {
                Visualizer.arm(this.elems[x]);
            }
            if (chosenOne != -1) {
                Visualizer.glow(this.elems[chosenOne]);
            }

        }

        this.returnToNormal = function() {

            for (var t = 0; t < this.elems.length; t++) {
                Visualizer.restore(this.elems[t]);
            }
        }

        this.clean = function() {
            $(this.elems).each(function() {
                Visualizer.clean(this);
            });
        }

    }

    /*
     * Object that represents the first cell clicked
     */
    function Root() {
        this.root = null;

        this.setRoot = function(root) {
            this.root = root;
            Visualizer.glow(this.root);
        }

        this.returnToNormal = function() {
            Visualizer.restore(this.root);
        }

        this.isSameCell = function(t) {
            return $(this.root).is($(t));
        }

        this.clean = function() {
            Visualizer.clean(this.root);
        }

    }

    /*
     * A utility object that manipulates the cell display based on the methods called.
     */
    var Visualizer = {

        glow: function(c) {
            $(c).removeClass("rf-armed")
                .removeClass("rf-selected")
                .addClass("rf-glowing");
        },

        arm: function(c) {
            $(c) //.removeClass("rf-selected")
                .removeClass("rf-glowing")
                .addClass("rf-armed");

        },

        restore: function(c) {
            $(c).removeClass("rf-armed")
                .removeClass("rf-glowing");

            if (c != null && $.data(c, "selected") == "true") {
                $(c).addClass("rf-selected");
            }
        },

        select: function(c) {
            $(c).removeClass("rf-armed")
                .removeClass("rf-glowing")
                .animate({
                    'opacity': '20'
                }, 500, "linear", function() {
                    $(c).removeClass("rf-highlight").addClass("rf-selected")
                        .animate({
                            'opacity': 'show'
                        }, 500, "linear")
                })


        },

        highlight: function(c) {
            $(c).removeClass("rf-armed")
                .removeClass("rf-selected")
                .addClass("rf-highlight");
        },

        signalWordFound: function(w) {

            $(w).css("background", 'yellow').animate({
                    "opacity": 'hide'
                }, 1000, "linear",
                function() {
                    $(w).css("background", 'white')
                    $(w).addClass('rf-foundword').animate({
                        "opacity": 'show'
                    }, 1000, "linear")
                });
        },



        clean: function(c) {
            $(c).removeClass("rf-armed")
                .removeClass("rf-glowing")
                .removeClass("rf-selected");

            $.removeData($(c), "selected");

        }
    }

    //--------------------------------------------------------
    // OBJECTS RELATED TO THE MODEL
    //------------------------------------------------------------------------------

    /*
     * Represents the individual cell on the grid
     */
    function Cell() {
        this.DEFAULT = "-";
        this.isHighlighted = false;
        this.value = this.DEFAULT;
        this.parentGrid = null;
        this.isUnwritten = function() {
            return (this.value == this.DEFAULT);
        };
        this.isSelected = false;
        this.isSelecting = true;
        this.td = null; // reference to UI component
        this.posx = [];
        this.posy = [];



    } //Cell

    /*
     * Represents the Grid
     */
    function Grid() {
        this.cells = null;

        this.directions = [
            "LeftDiagonal",
            "Horizontal",
            "RightDiagonal",
            "Vertical"
        ];

        this.initializeGrid = function(size) {
            //genera un array con 10 elementos
            this.cells = new Array(10);
            //recorro el array
            for (var i = 0; i < 10; i++) {
                this.cells[i] = new Array(17);
                for (var j = 0; j < 17; j++) {
                    var c = new Cell();
                    c.parentgrid = this;
                    this.cells[i][j] = c;
                }
            }
        }


        this.getCell = function(row, col) {

            return this.cells[row][col];
        }

        this.createHotZone = function(uic) {
            var $tgt = uic;

            var hzCells = new Array();
            var ix = $tgt.parent().children().index($tgt);

        }

        this.size = function() {
            //console.log('as',this.cells.length)
            return this.cells.length;
        }

        //place word on grid at suggested location
        this.put = function(row, col, word) {
            //Pick the right Strategy to place the word on the grid
            var populator = eval("new " + eval("this.directions[" + Math.floor(Math.random() * 4) + "]") + "Populator(row,col,word, this)");
            var isPlaced = populator.populate();

            //Didn't get placed.. brute force-fit (if possible)
            if (!isPlaced) {
                for (var x = 0; x < this.directions.length; x++) {
                    var populator2 = eval("new " + eval("this.directions[" + x + "]") + "Populator(row,col,word, this)");
                    var isPlaced2 = populator2.populate();
                    if (isPlaced2) break;

                }

            }
        }

        this.fillGrid = function() {

            for (var i = 0; i < 10; i++) {
                for (var j = 0; j < 17; j++) {
                    if (this.cells[i][j].isUnwritten()) {
                        this.cells[i][j].value = String.fromCharCode(Math.floor(65 + Math.random() * 26));
                    }
                }
            }

        }

    } //Grid



    var variableGlobal = new Array(10);
    for (var i = 0; i < 10; i++) {
        variableGlobal[i] = new Array(17);
        for (var j = 0; j < 17; j++) {
            variableGlobal[i][j] = undefined;
        }
    }



    /*
     * Set of strategies to populate the grid.
     */
    //Create a Horizontal Populator Strategy 
    function HorizontalPopulator(row, col, word, grid) {

        this.grid = grid;
        this.row = row;
        this.col = col;
        this.word = word;
        this.size = this.grid.size();
        this.cells = this.grid.cells;

        //populate the word
        this.populate = function() {


                // try and place word in this row

                // check if this row has a contigous block free
                // 1. starting at col (honour the input)
                if (this.willWordFit()) {
                    this.writeWord();
                } else {

                    // for every row - try to fit this
                    for (var i = 0; i < 10; i++) {

                        var xRow = (this.row + i) % 17; // loop through all rows starting at current;

                        // 2. try starting anywhere on line
                        var startingPoint = this.findContigousSpace(xRow, word);

                        if (startingPoint == -1) {
                            // if not, then try to see if we can overlap this word only any existing alphabets
                            var overlapPoint = this.isWordOverlapPossible(xRow, word);
                            if (overlapPoint == -1) {
                                // if not, then try another row and repeat process,
                                continue;
                            } else {
                                this.row = xRow;
                                this.col = overlapPoint;
                                this.writeWord();
                                break;
                            }
                        } else {
                            this.row = xRow;
                            this.col = startingPoint;
                            this.writeWord();
                            break;
                        }
                    } //for each row
                }
                // if still not, then return false (i.e. not placed. we need to try another direction
                return (word.isPlaced);


            } //populate


        //write word on grid at given location
        //also remember which cells were used for displaying the word
        this.writeWord = function() {
            if (this.cells[this.row] != undefined) {
                var chars = word.chars;
                for (var i = 0; i < word.size; i++) {
                    var c = new Cell();
                    c.value = chars[i];
                    this.cells[this.row][this.col + i] = c; 
                    if(variableGlobal[this.row][this.col + i] == undefined){
                        variableGlobal[this.row][this.col + i] = chars.join('');
                    } else{
                         variableGlobal[this.row][this.col + i] += " "+chars.join('');
                    }                  
                    


                    word.containedIn(c);
                    word.isPlaced = true;


                }

                console.log('palabras horizontales',chars.join(''));

            }


        }

        //try even harder, check if this word can be placed by overlapping cells with same content
        this.isWordOverlapPossible = function(row, word) {
            return -1; //TODO: implement
        }

        //check if word will fit at the chosen location
        this.willWordFit = function() {
            var isFree = false;
            var freeCounter = 0;
            var chars = this.word.chars;
            for (var i = col; i < this.size; i++) {
                if (this.cells[row][i].isUnwritten() || this.cells[row][i] == chars[i]) {
                    freeCounter++;
                    if (freeCounter == word.size) {
                        isFree = true;
                        break;
                    }
                } else {
                    break;
                }
            }
            return isFree;
        }

        //try harder, check if there is contigous space anywhere on this line.
        this.findContigousSpace = function(row, word) {
            if (this.cells[row] != undefined) {
                var freeLocation = -1;
                var freeCounter = 0;
                var chars = word.chars;
                for (var i = 0; i < this.size; i++) {
                    if (this.cells[row][i].isUnwritten() || this.cells[row][i] == chars[i]) {
                        freeCounter++;
                        if (freeCounter == word.size) {
                            freeLocation = (i - (word.size - 1));
                            break;
                        }
                    } else {
                        freeCounter = 0;
                    }
                }
                return freeLocation;
            }


        }
    } //HorizontalPopulator


    //Create a Vertical Populator Strategy 
    function VerticalPopulator(row, col, word, grid) {


        this.grid = grid;
        this.row = row;
        this.col = col;
        this.word = word;
        this.size = this.grid.size();
        this.cells = this.grid.cells;

        //populate the word
        this.populate = function() {


                // try and place word in this row

                // check if this row has a contigous block free
                // 1. starting at col (honour the input)
                if (this.willWordFit()) {
                    this.writeWord();
                } else {

                    // for every row - try to fit this
                    for (var i = 0; i < 10; i++) {

                        var xCol = (this.col + i) % 17; // loop through all rows starting at current;

                        // 2. try starting anywhere on line
                        var startingPoint = this.findContigousSpace(xCol, word);

                        if (startingPoint == -1) {
                            // if not, then try to see if we can overlap this word only any existing alphabets
                            var overlapPoint = this.isWordOverlapPossible(xCol, word);
                            if (overlapPoint == -1) {
                                // if not, then try another row and repeat process,
                                continue;
                            } else {
                                this.row = overlapPoint;
                                this.col = xCol;
                                this.writeWord();
                                break;
                            }
                        } else {
                            this.row = startingPoint;
                            this.col = xCol;
                            this.writeWord();
                            break;
                        }
                    } //for each row
                }
                // if still not, then return false (i.e. not placed. we need to try another direction
                return (word.isPlaced);


            } //populate


        //write word on grid at given location
        this.writeWord = function() {

            var chars = word.chars;
            for (var i = 0; i < word.size; i++) {
                var c = new Cell();
                c.value = chars[i];
                this.cells[this.row + i][this.col] = c; //CHANGED
                //variableGlobal[this.row + i][this.col] += chars.join('');

                 if(variableGlobal[this.row + i][this.col] == undefined){
                        variableGlobal[this.row + i][this.col] = chars.join('');
                    } else{
                         variableGlobal[this.row + i][this.col] += " "+chars.join('');
                    }      


                word.containedIn(c);
                word.isPlaced = true;
            }
            console.log('palabras verticales',chars.join(''));


        }

        //try even harder, check if this word can be placed by overlapping cells with same content
        this.isWordOverlapPossible = function(col, word) {
            return -1; //TODO: implement
        }

        //check if word will fit at the chosen location
        this.willWordFit = function() {
            var isFree = false;
            var freeCounter = 0;
            var chars = this.word.chars;
            for (var i = row; i < this.size; i++) { // CHANGED
                if (this.cells[i][col].isUnwritten() || chars[i] == this.cells[i][col].value) { //CHANGED
                    freeCounter++;
                    if (freeCounter == word.size) {
                        isFree = true;
                        break;
                    }
                } else {
                    break;
                }
            }
            return isFree;
        }

        //try harder, check if there is contigous space anywhere on this line.
        this.findContigousSpace = function(col, word) {
            var freeLocation = -1;
            var freeCounter = 0;
            var chars = word.chars;
            for (var i = 0; i < this.size; i++) {
                if (this.cells[i][col].isUnwritten() || chars[i] == this.cells[i][col].value) { //CHANGED
                    freeCounter++;
                    if (freeCounter == word.size) {
                        freeLocation = (i - (word.size - 1));
                        break;
                    }
                } else {
                    freeCounter = 0;
                }
            }
            return freeLocation;

        }
    } //VerticalPopulator


    //Create a LeftDiagonal Populator Strategy 
    function LeftDiagonalPopulator(row, col, word, grid) {

        this.grid = grid;
        this.row = row;
        this.col = col;
        this.word = word;
        this.size = this.grid.size();
        this.cells = this.grid.cells;

        //populate the word
        this.populate = function() {


                // try and place word in this row

                // check if this row has a contigous block free
                // 1. starting at col (honour the input)
                if (this.willWordFit()) {
                    this.writeWord();
                } else {

                    var output = this.findContigousSpace(this.row, this.col, word);

                    if (output[0] != true) {

                        // for every row - try to fit this
                        OUTER: for (var col = 0, row = (this.size - word.size); row >= 0; row--) {
                            for (var j = 0; j < 2; j++) {

                                var op = this.findContigousSpace((j == 0) ? row : col, (j == 0) ? col : row, word);

                                if (op[0] == true) {
                                    this.row = op[1];
                                    this.col = op[2];
                                    this.writeWord();
                                    break OUTER;
                                }
                            }

                        }
                    } else {
                        this.row = output[1];
                        this.col = output[2];
                        this.writeWord();
                    }


                }
                // if still not, then return false (i.e. not placed. we need to try another direction
                return (word.isPlaced);


            } //populate


        //write word on grid at given location
        //also remember which cells were used for displaying the word
        this.writeWord = function() {
            if (false) {
                var chars = word.chars;
                var lrow = this.row;
                var lcol = this.col;
                // if(lrow++ != undefined){
                for (var i = 0; i < word.size; i++) {
                    var c = new Cell();
                    c.value = chars[i];
                    variableGlobal[lrow][lcol] = chars.join('');
                    this.cells[lrow++][lcol++] = c;
                    word.containedIn(c);
                    word.isPlaced = true;


                }

            }

            //console.log('palabras diagonales izq',chars.join(''));
            //}

        }

        //try even harder, check if this word can be placed by overlapping cells with same content
        this.isWordOverlapPossible = function(row, word) {
            return -1; //TODO: implement
        }

        //check if word will fit at the chosen location
        this.willWordFit = function() {
            var isFree = false;
            var freeCounter = 0;
            var chars = this.word.chars;
            var lrow = this.row;
            var lcol = this.col;
            var i = 0;
            while (lcol < this.grid.size() && lrow < this.grid.size()) {
                if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                    freeCounter++;
                    if (freeCounter == word.size) {
                        isFree = true;
                        break;
                    }
                } else {
                    break;
                }
                lrow++;
                lcol++;

            }
            return isFree;
        }

        //try harder, check if there is contigous space anywhere on this line.
        this.findContigousSpace = function(xrow, xcol, word) {
            var freeLocation = false;
            var freeCounter = 0;
            var chars = word.chars;
            var lrow = xrow;
            var lcol = xcol;

            while (lrow > 0 && lcol > 0) {
                lrow--;
                lcol--;
            }
            var i = 0;
            while (true) {
                if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                    freeCounter++;
                    if (freeCounter == word.size) {
                        freeLocation = true;
                        break;
                    }
                } else {
                    freeCounter = 0;
                }
                lcol++;
                lrow++;

                if (lcol >= 17 || lrow >= 10) {
                    break;
                }
            }
            if (freeLocation) {
                lrow = lrow - word.size + 1;
                lcol = lcol - word.size + 1;
            }
            return [freeLocation, lrow, lcol];

        }
    } //LeftDiagonalPopulator


    //Create a RightDiagonal Populator Strategy 
    function RightDiagonalPopulator(row, col, word, grid) {

        this.grid = grid;
        this.row = row;
        this.col = col;
        this.word = word;
        this.size = this.grid.size();
        this.cells = this.grid.cells;

        //populate the word
        this.populate = function() {


                // try and place word in this row

                // check if this row has a contigous block free
                // 1. starting at col (honour the input)
                var rr = 0;
                if (this.willWordFit()) {
                    this.writeWord();
                } else {

                    var output = this.findContigousSpace(this.row, this.col, word);

                    if (output[0] != true) {

                        // for every row - try to fit this
                        OUTER: for (var col = 17 - 1, row = (10 - word.size); row >= 0; row--) {
                            for (var j = 0; j < 2; j++) {

                                var op = this.findContigousSpace((j == 0) ? row : (10 - 1 - col), (j == 0) ? col : (17 - 1 - row), word);

                                if (op != undefined) {
                                    if (op[0] == true) {
                                        this.row = op[1];
                                        this.col = op[2];
                                        this.writeWord();
                                        break OUTER;
                                    }
                                }

                            }

                        }
                    } else {
                        this.row = output[1];
                        this.col = output[2];
                        this.writeWord();
                    }


                }
                // if still not, then return false (i.e. not placed. we need to try another direction
                return (word.isPlaced);


            } //populate


        //write word on grid at given location
        //also remember which cells were used for displaying the word
        this.writeWord = function() {

            if (false) {
                var chars = word.chars;
                var lrow = this.row;
                var lcol = this.col;
                for (var i = 0; i < word.size; i++) {
                    var c = new Cell();
                    c.value = chars[i];
                    variableGlobal[lrow][lcol] = chars.join('');
                    this.cells[lrow++][lcol--] = c;
                    word.containedIn(c);
                    word.isPlaced = true;
                }
                //console.log('diagonal derecha',chars.join(''));
            }



        }

        //try even harder, check if this word can be placed by overlapping cells with same content
        this.isWordOverlapPossible = function(row, word) {
            return -1; //TODO: implement
        }

        //check if word will fit at the chosen location
        this.willWordFit = function() {
            var isFree = false;
            var freeCounter = 0;
            var chars = this.word.chars;
            var lrow = this.row;
            var lcol = this.col;
            var i = 0;
            while (lcol >= 0 && lrow < this.grid.size()) {
                if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                    freeCounter++;
                    if (freeCounter == word.size) {
                        isFree = true;
                        break;
                    }
                } else {
                    break;
                }
                lrow++;
                lcol--;

            }
            return isFree;
        }

        //try harder, check if there is contigous space anywhere on this line.
        this.findContigousSpace = function(xrow, xcol, word) {
            var freeLocation = false;
            var freeCounter = 0;
            var chars = word.chars;
            var lrow = xrow;
            var lcol = xcol;

            if (this.cells[lrow] != undefined) {
                while (lrow > 0 && lcol < 17 - 1) {
                    lrow--;
                    lcol++;
                }
                var i = 0;
                while (lcol >= 0 && lrow < this.grid.size()) {
                    if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                        freeCounter++;
                        if (freeCounter == word.size) {
                            freeLocation = true;
                            break;
                        }
                    } else {
                        freeCounter = 0;
                    }
                    lrow++;
                    lcol--;
                    //            if (lcol <= 0 || lrow > this.size-1) {
                    //                break;
                    //            }
                }
                if (freeLocation) {
                    lrow = lrow - word.size + 1;
                    lcol = lcol + word.size - 1;
                }
                return [freeLocation, lrow, lcol];

            }



        }
    } //RightDiagonalPopulator

    /*
     * Container for the Entire Model
     */
    function Model() {
        this.grid = null;
        this.wordList = null;

        this.init = function(grid, list) {
            this.grid = grid;
            this.wordList = list;

            for (var i = 0; i < this.wordList.size(); i++) {
                grid.put(Util.random(this.grid.size()), Util.random(this.grid.size()), this.wordList.get(i));
            }

        }

    } //Model

    /*
     * Represents a word on the grid
     */
    function Word(val) {
        this.value = val.toUpperCase();
        this.originalValue = this.value;
        this.isFound = false;
        this.cellsUsed = new Array();

        this.isPlaced = false;
        this.row = -1;
        this.col = -1;
        this.size = -1;
        this.chars = null;

        this.init = function() {
            this.chars = this.value.split("");
            this.size = this.chars.length;
        }
        this.init();

        this.containedIn = function(cell) {
            this.cellsUsed.push(cell);
        }



        this.checkIfSimilar = function(w) {
            if (this.originalValue == w || this.value == w) {
                this.isFound = true;
                return true;
            }
            return false;
        }


    }

    /*
     * Represents the list of words to display
     */
    function WordList() {
        this.words = new Array();

        this.loadWords = function(csvwords) {
            var $n = this.words;
            $(csvwords.split(",")).each(function() {
                $n.push(new Word(this));
            });

        }

        this.add = function(word) {
            //here's where we reverse the letters randomly
            if (Math.random() * 10 > 5) {
                var s = "";
                for (var i = word.size - 1; i >= 0; i--) {
                    s = s + word.value.charAt(i);
                }
                word.value = s;
                word.init();
            }
            this.words[this.words.length] = word;
        }

        this.size = function() {
            return this.words.length;
        }

        this.get = function(index) {
            return this.words[index];
        }

        this.isWordPresent = function(word2check) {
            for (var x = 0; x < this.words.length; x++) {
                if (this.words[x].checkIfSimilar(word2check)) return x;
            }
            return -1;
        }
    }

    /*
     * Utility class
     */
    var Util = {
        random: function(max) {
            return Math.floor(Math.random() * max);
        },

        log: function(msg) {
            $("#logger").append(msg);
        }
    }


    //------------------------------------------------------------------------------
    // OBJECTS RELATED TO THE CONTROLLER
    //------------------------------------------------------------------------------
    /*
     * Main controller that interacts with the Models and View Helpers to render and
     * control the game
     */
    var GameWidgetHelper = {
        prepGrid: function(size, words) {
            //console.log('words', words);
            var grid = new Grid();
            grid.initializeGrid(size);

            var wordList = new WordList();
            wordList.loadWords(words);

            var model = new Model();
            model.init(grid, wordList);
            grid.fillGrid();
            return model;


        },

        renderGame: function(container, model) {
            var grid = model.grid;
            var cells = grid.cells;
            //console.log('cells',cells);



            var puzzleGrid = "<div id='rf-searchgamecontainer'><p class='title-p'>What&prime;s the big idea? The five hidden words below explain everything we&prime;re about.</p><table id='rf-tablegrid' cellspacing=0 cellpadding=0 class='rf-tablestyle'>";
            for (var i = 0; i < 10; i++) {
                puzzleGrid += "<tr>";
                for (var j = 0; j < 17; j++) {


                    if (variableGlobal[i][j] != undefined) {
                        puzzleGrid += "<td data-foo='" + variableGlobal[i][j] + "'  class='rf-tgrid toPaint " + variableGlobal[i][j] + "'>" + cells[i][j].value + "</td>";
                    } else {
                        puzzleGrid += "<td  class='rf-tgrid'>" + cells[i][j].value + "</td>";
                    }



                }
                puzzleGrid += "</tr>";
            }
           /*puzzleGrid += '<tr><td class="rf-tgrid">T</td><td class="rf-tgrid">K</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">I</td><td class="rf-tgrid">C</td><td class="rf-tgrid">X</td><td class="rf-tgrid">A</td><td class="rf-tgrid">V</td><td class="rf-tgrid">G</td><td class="rf-tgrid">N</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">K</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">C</td><td class="rf-tgrid">T</td><td class="rf-tgrid">R</td><td class="rf-tgrid">J</td><td class="rf-tgrid">N</td><td class="rf-tgrid">S</td><td class="rf-tgrid">T</td></tr><tr><td class="rf-tgrid">K</td><td class="rf-tgrid">E</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">N</td><td class="rf-tgrid">R</td><td class="rf-tgrid">I</td><td class="rf-tgrid">E</td><td class="rf-tgrid">L</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">F</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">I</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">U</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">D</td><td class="rf-tgrid">C</td><td class="rf-tgrid">J</td><td class="rf-tgrid">X</td></tr><tr><td class="rf-tgrid">A</td><td class="rf-tgrid">H</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">V</td><td class="rf-tgrid">T</td><td class="rf-tgrid">S</td><td class="rf-tgrid">P</td><td class="rf-tgrid">S</td><td class="rf-tgrid">N</td><td class="rf-tgrid">U</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">N</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">R</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">J</td><td class="rf-tgrid">I</td><td class="rf-tgrid">P</td><td class="rf-tgrid">R</td></tr><tr><td class="rf-tgrid">N</td><td class="rf-tgrid">A</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">E</td><td class="rf-tgrid">L</td><td class="rf-tgrid">P</td><td class="rf-tgrid">U</td><td class="rf-tgrid">M</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">J</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">D</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">I</td><td class="rf-tgrid">E</td><td class="rf-tgrid">I</td><td class="rf-tgrid">A</td><td class="rf-tgrid">P</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">U</td></tr><tr><td class="rf-tgrid">R</td><td class="rf-tgrid">U</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">N</td><td class="rf-tgrid">W</td><td class="rf-tgrid">E</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">X</td><td class="rf-tgrid">K</td><td class="rf-tgrid">W</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">N</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">O</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">A</td><td class="rf-tgrid">U</td><td class="rf-tgrid">P</td><td class="rf-tgrid">U</td><td class="rf-tgrid">V</td></tr><tr><td class="rf-tgrid">V</td><td class="rf-tgrid">L</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">T</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">C</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">O</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">U</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">R</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">A</td><td data-foo="COURAGE" class="rf-tgrid toPaint COURAGE " style="opacity: 20;">G</td><td data-foo="COURAGE KINDNESS" class="rf-tgrid toPaint COURAGE KINDNESS " style="opacity: 20;">E</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">S</td><td class="rf-tgrid">X</td><td class="rf-tgrid">K</td><td class="rf-tgrid">V</td><td class="rf-tgrid">E</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">Y</td></tr><tr><td class="rf-tgrid">A</td><td class="rf-tgrid">E</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">I</td><td class="rf-tgrid">C</td><td class="rf-tgrid">M</td><td class="rf-tgrid">C</td><td class="rf-tgrid">K</td><td class="rf-tgrid">W</td><td class="rf-tgrid">B</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">S</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">I</td><td class="rf-tgrid">H</td><td class="rf-tgrid">V</td><td class="rf-tgrid">W</td><td class="rf-tgrid">V</td><td class="rf-tgrid">A</td><td class="rf-tgrid">R</td></tr><tr><td class="rf-tgrid">N</td><td class="rf-tgrid">C</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">O</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">O</td><td class="rf-tgrid">F</td><td class="rf-tgrid">W</td><td class="rf-tgrid">H</td><td class="rf-tgrid">Y</td><td data-foo="KINDNESS" class="rf-tgrid toPaint KINDNESS " style="opacity: 20;">S</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">T</td><td class="rf-tgrid">S</td><td class="rf-tgrid">U</td><td class="rf-tgrid">U</td><td class="rf-tgrid">G</td><td class="rf-tgrid">F</td><td class="rf-tgrid">D</td></tr><tr><td class="rf-tgrid">V</td><td class="rf-tgrid">O</td><td data-foo="INVENTION" class="rf-tgrid toPaint INVENTION " style="opacity: 20;">N</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">P</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">J</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">V</td><td data-foo="CURIOSITY" class="rf-tgrid toPaint CURIOSITY " style="opacity: 20;">Y</td><td class="rf-tgrid">O</td><td class="rf-tgrid">F</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">E</td><td class="rf-tgrid">J</td><td class="rf-tgrid">U</td></tr><tr><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">C</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">O</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">M</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">M</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">U</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">N</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">I</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">T</td><td data-foo="COMMUNITY" class="rf-tgrid toPaint COMMUNITY " style="opacity: 20;">Y</td><td class="rf-tgrid">C</td><td class="rf-tgrid">Z</td><td class="rf-tgrid">Y</td><td class="rf-tgrid">V</td><td class="rf-tgrid">D</td><td class="rf-tgrid">Q</td><td class="rf-tgrid">I</td><td class="rf-tgrid">Q</td></tr>';*/


            puzzleGrid += "</table></div>";
            $(container).append(puzzleGrid);

            var x = 0;
            var y = 0;
            $("tr", "#rf-tablegrid").each(function() {
                $("td", this).each(function(col) {
                    var c = cells[x][y++];
                    $.data(this, "cell", c);
                    c.td = this;
                })
                y = 0;
                x++;
            });

            var words = "<div id='rf-wordcontainer'><ul>"
            $(model.wordList.words).each(function() {
                words += '<li class=rf-p' + this.isPlaced + '>' + this.originalValue + '</li>';
            });
            words += "</ul></div>";

            $(container).append(words);


        },

        signalWordFound: function(idx) {
            var w = $("#theGrid li").get(idx);
            if (!jQuery(w).hasClass('rf-foundword')) {
                Visualizer.signalWordFound(w);
                currentWord++;
                if (typeof encontrePalabra == "function") {
                    encontrePalabra({
                        id: idx,
                        word: $(w).text()
                    });
                }
                if (typeof cuandoEncuentreTodas == "function") {
                    if (currentWord >= maxWords) {
                        cuandoEncuentreTodas({});
                    }
                }
            }
        }

    }

    $(document).ready(function() {

       
        $('.fancybox').click(function() {
            $('#containerGrid').hide();
            $('#containerVideo').addClass('showVideo');
            //$('#containModal').show();
            $('#modal').addClass('active');
            $('#containerVideo video').trigger('play');
        })
        $('#modal .btn').click(function() {

            $('#containModal').hide();
            $('#modal').removeClass('active');
            $('#modal video')[0].currentTime = 0;
            $('#modal video').trigger('pause');
        })

        var words = "INVENTION,COURAGE,COMMUNITY,CURIOSITY,KINDNESS";
        //var arrWord = aux = words.split(',');
        //var contWord = arrWord.length;
        //console.log('aaa',contWord);


        //attach the game to a div
        $("#theGrid").wordsearchwidget({
            "wordlist": words,
            "gridsize": 17,
            "onWordFound": function(ob) {
                $('#onWordFound').html("Found: " + ob.word);
                d = setTimeout(function() {
                    clearTimeout(d);
                    $('#onWordFound').html(" ");
                }, 3000);

            },
            "onWordSearchComplete": function() {
                console.log('lalala');
                $('#onWordSearchComplete').html("Word Search Complete");
                //$(location).attr('href','video.html'); 
                //window.open('video.html','_blank');
            }
        });

        var count = 0;

        $('.toPaint').hover(function() {

            $clase = $(this).data('foo');

            /*arrWord.forEach(function(value){
                if(value == $clase){
                    console.log('a',value,$clase);
                    aux.pop();
                }
            });*/

            //console.log('elemeto',aux.length);

            Visualizer.select($(this).data('foo'));
            $('.' + $clase).each(function() {
                Visualizer.select($(this));
            });

            if ($('#rf-tablegrid .rf-selected').length > 35 && count < 1) {
                count++;

                $('#containerGrid').hide();
                $('#containerVideo').addClass('showVideo');
                $('#containerVideo video').trigger('play');
              
                 
            }

            //console.log('tamanio',$('#rf-tablegrid .rf-selected').length);



        })



    });


})(jQuery);