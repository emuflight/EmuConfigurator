'use strict';
/*
Todo:
draw CG
*/

// re-use & modifications as permitted by iforce2d.net Chris Campbell

var run = false; ////moved to ready() ; true work fine for website, but embedded tab will animate faster and faster with each entry
var canvas = null;
var ctx = null;
var motors = [];
var relations = [];
var reparseTimer = null;
var scale = 1;
var limit = 200;
var cogImage = null;
var commandType = "cf1.10"; //default cleanflight 1.10+ (mmix)
var mousePos = {
    x: 0,
    y: 0
};
var highlightedMotor = null;
var draggingMotor = false;
String.prototype.paddingLeft = function(paddingValue) {
    return String(paddingValue + this).slice(-paddingValue.length);
};
$.fn.selectRange = function(start, end) {
    if (!end) end = start;
    return this.each(function() {
        if (this.setSelectionRange) {
            this.focus();
            this.setSelectionRange(start, end);
        } else if (this.createTextRange) {
            var range = this.createTextRange();
            range.collapse(true);
            range.moveEnd('character', end);
            range.moveStart('character', start);
            range.select();
        }
    });
};
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
        window.setTimeout(callback, 1000 / 60);
    };
})();

function animate() {
    if (run) requestAnimFrame(animate);
    step();
}

function step() {
    if (!draggingMotor) {
        //rotate motor images
        for (var i = 1; i < motors.length; i++) {
            var motor = motors[i];
            if (motor.image) {
                if ((motor.image.angle < -360) || (motor.image.angle > 360)) {motor.image.angle = 0}; //reset
                motor.image.angle += (motor.direction == 1 ? 1 : -1) * 0.05; //0.015;  //animation speed (increment/decrement angle)
                motor.imageAngle = motor.image.angle;
            }
        }
        relaxConnections();
    }
    calculateMixerValues();
    updateMmixCommands();
    draw();
}

function getMotorByNumber(n) {
    for (var i = 0; i < motors.length; i++) {
        if (motors[i].number == n) {
            return motors[i];
        }
    }
    console.log("debug: mixercalc: Can't find motor with number: " + n);
    return null;
}

function getMotorIndexByNumber(n) {
    for (var i = 0; i < motors.length; i++) {
        if (motors[i].number == n) {
            return i;
        }
    }
    console.log("debug: mixercalc: Can't find motor with number: " + n);
    return null;
}

function relaxConnections() {
    var uptake = 0.1;
    for (var i = 0; i < relations.length; i++) {
        var relation = relations[i];
        var ma = getMotorByNumber(relation.a); // motors[relation.a];
        var mb = getMotorByNumber(relation.b); // motors[relation.b];
        if (!ma || !mb) continue;
        var origA = ma.position;
        var origB = mb.position;
        var midpoint = mid(ma.position, mb.position);
        if (relation.distance) {
            var ta = ideal(midpoint, ma.position, 0.5 * relation.distance);
            var tb = ideal(midpoint, mb.position, 0.5 * relation.distance);
            ma.position = lerp(ma.position, ta, uptake);
            mb.position = lerp(mb.position, tb, uptake);
        } else if (relation.h) {
            var ta = ideal(midpoint, ma.position, 0);
            var tb = ideal(midpoint, mb.position, 0);
            var newposa = lerp(ma.position, ta, uptake);
            var newposb = lerp(mb.position, tb, uptake);
            ma.position.y = newposa.y;
            mb.position.y = newposb.y;
        } else if (relation.v) {
            var ta = ideal(midpoint, ma.position, 0);
            var tb = ideal(midpoint, mb.position, 0);
            var newposa = lerp(ma.position, ta, uptake);
            var newposb = lerp(mb.position, tb, uptake);
            ma.position.x = newposa.x;
            mb.position.x = newposb.x;
        }
    }
}

function dist(pa, pb) {
    var dx = pa.x - pb.x;
    var dy = pa.y - pb.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function mid(pa, pb) {
    return {
        x: 0.5 * (pa.x + pb.x),
        y: 0.5 * (pa.y + pb.y)
    };
}

function ideal(p0, p1, distance) {
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    dx /= d;
    dy /= d;
    return {
        x: p0.x + distance * dx,
        y: p0.y + distance * dy
    };
}

function lerp(p0, p1, uptake) {
    return {
        x: p0.x + uptake * (p1.x - p0.x),
        y: p0.y + uptake * (p1.y - p0.y)
    };
}

function calculateMixerValues() {
    var fcpos = motors[0].position;
    // bounding box of all motors
    var maxx = -100000;
    var maxy = -100000;
    for (var i = 1; i < motors.length; i++) {
        var motor = motors[i];
        maxx = Math.max(Math.abs(motor.position.x - fcpos.x), maxx);
        maxy = Math.max(Math.abs(motor.position.y - fcpos.y), maxy);
    }
    scale = 1;
    if (maxx > maxy) scale = 1 / maxx;
    else scale = 1 / maxy;
    // set mixpos in each motor as percentage of furthest distance
    //var mixervals = "";
    for (var i = 0; i < motors.length; i++) {
        var motor = motors[i];
        //var vx = (motor.position.x - fcpos.x) * scale;
        //var vy = (motor.position.y - fcpos.y) * scale;
        //motor.mixvalue = { x:vx, y:vy };
        motor.mixvalue = motorPosToMixerPos(motor.position);
        //mixervals += "Motor "+i+": "+Number(motor.mixvalue.x).toFixed(4)+", "+Number(motor.mixvalue.y).toFixed(4)+"<br>";
    }
    //mixervals += "Scale: "+scale+"<br>";
    //$("#mixervals").html(mixervals);
}

function updateMmixCommands() {
    var mmix = "";
    mmix += "mixer custom\n";
    mmix += "mmix reset\n";
//    var cmix = "";
//    cmix += "mixer custom\n";
//    cmix += "cmix reset\n";
//    var mwii = "";
//    var kk2mix = '<span style="color:red">*** This has not been tested!! ***</span>\n\n';
//    var arducoptermix = ''; //'<span style="color:red">*** This has not been tested!! ***</span>\n\n';
    if (motors.length > 1) {
        var cg = {
            x: 0,
            y: 0
        };
        var cg2 = {
            x: 0,
            y: 0
        };
        for (var i = 1; i < motors.length; i++) {
            var motor = getMotorByNumber(i); // motors[i];
            cg.x += motor.mixvalue.x;
            cg.y += motor.mixvalue.y;
            cg2.x += motor.position.x;
            cg2.y += motor.position.y;
        }
        cg.x /= (motors.length - 1);
        cg.y /= (motors.length - 1);
        cg2.x /= (motors.length - 1);
        cg2.y /= (motors.length - 1);
        var maxdist = -100000;
        var maxdistyaw = -100000;
        var maxdistkk = -100000;
        for (var i = 1; i < motors.length; i++) {
            var motor = getMotorByNumber(i); // motors[i];
            maxdist = Math.max(Math.abs(motor.mixvalue.x - cg.x), maxdist);
            maxdist = Math.max(Math.abs(motor.mixvalue.y - cg.y), maxdist);
            var d = dist(motor.mixvalue, cg);
            maxdistyaw = Math.max(d, maxdistyaw);
            d = dist(motor.position, cg2);
            maxdistkk = Math.max(d, maxdistkk);
        }
        for (var i = 1; i < motors.length; i++) {
            var motor = getMotorByNumber(i); // motors[i];
            var d = dist(motor.mixvalue, cg);
            var x = parseFloat(Number(-(motor.mixvalue.x - cg.x) / maxdist).toFixed(3));
            var y = parseFloat(Number(-(motor.mixvalue.y - cg.y) / maxdist).toFixed(3));
            var z = parseFloat(Number(((motor.direction == 0 ? -1 : 1) * d) / maxdistyaw).toFixed(3));
            z = motor.direction == 0 ? -1 : 1; // hmm... yaw values are always the same magnitude no matter their location
            //cmix += "cmix " + i + " 1 " + x + " " + y + " " + z + "\n";
            mmix += "mmix " + (i - 1) + " 1 " + x + " " + y + " " + z + "\n";
            //mwii += "motor[" + (i - 1) + "] = PIDMIX(" + x + "," + y + "," + z + ");\n"
            //arducoptermix += "add_motor_raw(AP_MOTORS_MOT_" + i + ", " + x + ", " + (-y) + ", AP_MOTORS_MATRIX_YAW_FACTOR_" + (z > 0 ? "CCW" : "CW") + ", " + i + ");\n"
            //var a = (0.5 * Math.PI) + Math.atan2(y, -x);
            //if (a < 0) a += 2 * Math.PI;
            //var deg = a * 180 / Math.PI;
            //var d = dist(motor.position, cg2);
            //var f = d / maxdistkk;
            //var p = Math.cos(a) * f * 100;
            //var r = Math.sin(a) * f * 100;
            //p = p.toFixed(0);
            //r = r.toFixed(0);
            //if (p == -0) p = 0;
            //if (r == -0) r = 0;
            //kk2mix += "Motor " + i + ": P= " + p.toString().paddingLeft("   ") + "   R= " + r.toString().paddingLeft("   ") + "\n";
        }
        //cmix += "save\n";
        mmix += "set yaw_motors_reversed = OFF\n";
        mmix += "save\n";
    }
    //$("#mmixcommands").text(cmix);
    //$("#mwiicommands").text(mwii);
    switch (commandType) {
        case "cf1.10":
            $("#commands").text(mmix);
            break;
    }

    //Disable legacy mix types
    //if (commandType == "multiwii") {
    //    $("#commands").text(mwii);
    //} else if (commandType == "cf1.9") {
    //    $("#commands").text(cmix);
    //} else if (commandType == "cf1.10") {
    //    $("#commands").text(mmix);
    //} else if (commandType == "kk2") {
    //    $("#commands").html(kk2mix);
    //} else if (commandType == "arducopter") {
    //    $("#commands").html(arducoptermix);
    //} else {
    //    $("#commands").text("Select a command type");
    //}
}

function updateMotorConstraintsSatisfied() {
    for (var i = 0; i < motors.length; i++) {
        motors[i].constraints = 0;
    }
    for (var i = 0; i < relations.length; i++) {
        var relation = relations[i];
        if (!relation.distance) {
            continue;
        }
        motors[getMotorIndexByNumber(relation.a)].constraints += 1;
        motors[getMotorIndexByNumber(relation.b)].constraints += 1;
    }
    for (var i = 0; i < motors.length; i++) {
      console.log("debug: mixercalc: Motor ["+i+"](#"+motors[i].number+")"+" has "+motors[i].constraints+" constraints.");
    }
}

function draw() {
    ctx.fillStyle = 'rgb(62,62,62)'; //'rgb(245,245,245)';  //canvas color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.125)";
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(300, 300);
    // CG
    if (motors.length > 1) {
        var cg = {
            x: 0,
            y: 0
        };
        for (var i = 1; i < motors.length; i++) {
            cg.x += motors[i].mixvalue.x;
            cg.y += motors[i].mixvalue.y;
        }
        cg.x /= (motors.length - 1);
        cg.y /= (motors.length - 1);
        /*ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
        ctx.beginPath();
        ctx.arc(cg.x * limit, cg.y * limit, 9, 0, 2 * Math.PI, false);
        ctx.fill();*/
        ctx.save();
        ctx.translate(cg.x * limit, cg.y * limit);
        ctx.scale(0.33, 0.33);
        ctx.translate(-cogImage.width / 2, -cogImage.height / 2);
        ctx.drawImage(cogImage, 0, 0);
        ctx.restore();
    }
    // direction relation lines
    for (var i = 0; i < relations.length; i++) {
        var relation = relations[i];
        if (!relation.h && !relation.v) continue;
        var ma = getMotorByNumber(relation.a); //motors[relation.a];
        var mb = getMotorByNumber(relation.b); //motors[relation.b];
        //if (relation.h) ctx.strokeStyle = "rgba(0, 255, 0, 1)";  //green horizontal
        //else ctx.strokeStyle = "rgba(0, 0, 255, 1)";             //blue vertical
        ctx.strokeStyle = "rgba(0, 163, 224, 1)";  // emuBlue for both horizontal and vertical
        ctx.beginPath();
        ctx.moveTo(ma.mixvalue.x * limit, ma.mixvalue.y * limit);
        ctx.lineTo(mb.mixvalue.x * limit, mb.mixvalue.y * limit);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.50)"; //"rgba(0, 0, 0, 0.0625)";
    // distance relation lines
    for (var i = 0; i < relations.length; i++) {
        var relation = relations[i];
        if (!relation.distance) continue;
        var ma = getMotorByNumber(relation.a); //motors[relation.a];
        var mb = getMotorByNumber(relation.b); //motors[relation.b];
        ctx.beginPath();
        ctx.moveTo(ma.mixvalue.x * limit, ma.mixvalue.y * limit);
        ctx.lineTo(mb.mixvalue.x * limit, mb.mixvalue.y * limit);
        ctx.stroke();
    }
    ctx.font = "18px Arial";
    // motors
    for (var i = 1; i < motors.length; i++) {
        if (i == highlightedMotor) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgb(0,162,244)"; //"rgb(255,128,0)"; //orange
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        } else {
            ctx.shadowBlur = 0;
        }
        // motor images
        ctx.save();
        var motor = motors[i];
        var imageObj = motor.image;
        if (imageObj) {
            ctx.translate(motor.mixvalue.x * limit, motor.mixvalue.y * limit);
            ctx.rotate(imageObj.angle);
            var s = (i == 0 ? 0.5 : 0.75);
            ctx.scale(s, s);
            ctx.translate(-imageObj.width / 2, -imageObj.height / 2);
            ctx.drawImage(imageObj, 0, 0);
        }
        ctx.restore();
        // motor inner circles
        if (motor.constraints > 2) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.5)";  //green
            //console.log("debug: mixercalc: motor ["+i+"](#"+motor.number+")"+" has "+motor.constraints+" so coloring it green.");
        } else {
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)";                        //red
            //console.log("debug: mixercalc: motor ["+i+"](#"+motor.number+")"+" has "+motor.constraints+" so coloring it red.");
        }
        ctx.beginPath();
        ctx.arc(motor.mixvalue.x * limit, motor.mixvalue.y * limit, 12, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.shadowBlur = 0;
        // don't show number on FC
        if (i == 0) continue;
        ctx.fillStyle = "black";
        // motor numbers
        ctx.save();
        ctx.translate(motor.mixvalue.x * limit, motor.mixvalue.y * limit - 6);
        ctx.scale(1, -1);
        ctx.fillText(motor.number, 0, 0);
        ctx.restore();
    }
    ctx.font = "14px Arial";
    // distance relation text
    for (var i = 0; i < relations.length; i++) {
        var relation = relations[i];
        if (!relation.distance) continue;
        var ma = getMotorByNumber(relation.a); //motors[relation.a];
        var mb = getMotorByNumber(relation.b); //motors[relation.b];
        ctx.save();
        ctx.translate(0.5 * (ma.mixvalue.x + mb.mixvalue.x) * limit, 0.5 * (ma.mixvalue.y + mb.mixvalue.y) * limit - 6);
        ctx.scale(1, -1);
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.strokeText(relation.distance, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,1.0)';//'rgba(0,0,0,0.75)';
        ctx.fillText(relation.distance, 0, 0);
        ctx.restore();
    }
    ctx.restore();
    ctx.restore();
}

function initMotorImages() {
    for (var i = 0; i < motors.length; i++) {
        var motor = motors[i];
        if (motor.image) {
            continue;
        }
        var imageObj = new Image();
        imageObj.width = 150;
        imageObj.height = 150;
        if (motor.number == 0) {
            imageObj.src = "resources/mixercalc/cog.png";
        } else if (motor.direction == 1) {
            imageObj.src = "resources/mixercalc/emu-prop-cw.png";
        } else {
            imageObj.src = "resources/mixercalc/emu-prop-ccw.png";
        }
        imageObj.angle = motor.imageAngle ? motor.imageAngle : 0;
        motor.image = imageObj;
    }
}

function startReparseTimer() {
    if (reparseTimer) clearTimeout(reparseTimer);
    reparseTimer = setTimeout(function() {
        doReparse();
    }, 2000);
}

function doReparse() {
    var input = $("#inputs").val();
    var lines = input.split("\n");
    var error = false;
    var constraints = [];
    for (var i = 0; i < lines.length && !error; i++) {
        var line = lines[i].trim();
        line = line.replace(/\s+/g, ' ');
        if (line == " " || line == "") {
            continue;
        }
        var parts = line.split(' ');
        if (parts.length == 3) {
            var ma = parseInt(parts[0].trim());
            var mb = parseInt(parts[1].trim());
            var val = parts[2].trim().toLowerCase();
            if (isNaN(ma) || isNaN(mb) || (ma >= motors.length) || (mb >= motors.length) || !(val == 'h' || val == 'v' || !isNaN(parseInt(val)))) {
                error = true;
            } else constraints.push([ma, mb, val]);
        } else if (parts.length != 0) {
            error = true;
        }
    }
    if (!error) {
        relations = [];
        for (var i = 0; i < constraints.length; i++) {
            var ma = constraints[i][0];
            var mb = constraints[i][1];
            var val = constraints[i][2].toLowerCase();
            if (val == "h") {
                relations.push({
                    a: ma,
                    b: mb,
                    h: true
                });
            } else if (val == "v") {
                relations.push({
                    a: ma,
                    b: mb,
                    v: true
                });
            } else {
                relations.push({
                    a: ma,
                    b: mb,
                    distance: parseInt(val)
                });
            }
        }
        updateMotorConstraintsSatisfied();
    }

    console.log("debug: mixercalc: doReparse");
}

function addMotorsRadial(howMany, layout) {
    while (motors.length > 1) //howMany+1)
        motors.pop();
    var radius = 200;
    var offset = howMany == 4 ? -0.5 : howMany == 6 ? 0 : 0.5;
    for (var i = 0; motors.length < (howMany + 1); i++) {
        var x = Math.cos((i + offset) / howMany * 2 * Math.PI);
        var y = Math.sin((i + offset) / howMany * 2 * Math.PI);
        motors.push({
            number: (i + 1),
            direction: (i % 2),
            position: {
                x: 300 + (radius * x),
                y: 300 + (radius * y)
            }
        });
    }
    switch (howMany) {
        case 4: {
            if (layout == "cf") {
                motors[3].number = 4;
                motors[4].number = 3;
            }
        }
        break;
    case 6: {
        if (layout == "cf") {
            motors[1].number = 5;
            motors[2].number = 2;
            motors[3].number = 4;
            motors[4].number = 6;
            motors[5].number = 3;
            motors[6].number = 1;
        }
    }
    break;
    case 8: {
        if (layout == "cf") {
            motors[1].number = 6;
            motors[2].number = 2;
            motors[3].number = 5;
            motors[4].number = 1;
            motors[5].number = 8;
            motors[6].number = 4;
            motors[7].number = 7;
            motors[8].number = 3;
        }
    }
    break;
    }
    for (var i = 1; i < motors.length; i++) motors[i].image = null;
    initMotorImages();
}

function doPreset(which) {
    switch (which) {
        case "quadx":
            addMotorsRadial(4, "cf");
            $("#inputs").val("");
            break;
        case "apex5":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 208 \n" +
                "3 4 208 \n" +
                "1 3 218 \n" +
                "2 4 218\n" +
                "1 4 256\n" +
                "2 3 256\n" +
                "2 4 h\n" +
                "1 3 h\n" +
                "1 2 v\n" +
                "3 4 v\n");
            break;
        case "clone6":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 158 \n" +
                "3 4 158 \n" +
                "1 3 212 \n" +
                "2 4 212\n" +
                "1 4 304.24\n" +
                "2 3 304.24\n" +
                "2 4 h\n" +
                "1 3 h\n" +
                "1 2 v\n" +
                "3 4 v\n");
            break;
        case "quad+":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 150\n" +
                "1 3 150\n" +
                "2 4 150\n" +
                "3 4 150\n" +
                "1 4 212.132\n" +
                "2 3 212.132\n" +
                "1 4 v\n" +
                "2 3 h");
            break;
        case "zmr":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 156\n" +
                "3 4 156\n" +
                "1 3 202\n" +
                "2 4 202\n" +
                "1 4 256\n" +
                "2 3 256\n" +
                "2 4 h\n" +
                "1 3 h\n" +
                "1 2 v");
            break;
        case "deadcat7":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 182\n" +
                "2 4 287\n" +
                "3 4 182\n" +
                "1 3 269\n" +
                "1 4 332\n" +
                "2 3 332\n" +
                "2 4 h\n" +
                "1 3 h");
            break;
        case "gh160":
            addMotorsRadial(4, "cf");
            $("#inputs").val(
                "1 2 107\n" +
                "3 4 107\n" +
                "1 3 110\n" +
                "2 4 135\n" +
                "1 4 162\n" +
                "2 3 162\n" +
                "2 4 h\n" +
                "1 3 h");
            break;
        case "hexx":
            addMotorsRadial(6, "cf");
            $("#inputs").val("");
            break;
        case "octx":
            addMotorsRadial(8, "cf");
            $("#inputs").val("");
            break;
        case "jure":
            addMotorsRadial(8, "cf");
            $("#inputs").val(
                "2 7 998\n" +
                "4 5 998\n" +
                "2 5 765\n" +
                "4 7 765\n" +
                "2 5 h\n" +
                "2 7 v\n" +
                "3 6 344\n" +
                "1 8 344\n" +
                "3 8 530\n" +
                "1 6 530\n" +
                "1 6 h\n" +
                "1 8 v\n" +
                "3 6 v\n" +
                "3 8 h");
            break;
        }
    doReparse();
}
$(document).ready(function() {
//    $(".toggleDivLink").click(function(e) {
//        e.preventDefault();
//        var divId = $(this).attr("divid");
//        $("#" + divId).slideToggle("slow");
//    });
//    $(".toggleDivLinkAll").click(function(e) {
//        e.preventDefault();
//        var divId = $(this).attr("divid");
//        $("." + divId).slideToggle("slow");
//    });
//    //setTimeout(function(){listLessons();}, 200);
//    $("#animtoggle").click(function() {
//        run = !run;
//        if (run) animate();
//    });
    $(".outputpanel").mouseenter(function() {
        run = false;
        animate();
    });
    $(".outputpanel").mouseleave(function() {
        run = true;
        animate();
    });
    $("#inputs").keyup(function() {
        startReparseTimer();
    });
    $("#inputs").change(function() {
        startReparseTimer();
    });
    $(".preset").click(function(event) {
        event.preventDefault();
        doPreset(event.target.id);
    });
    canvas = document.getElementById('mixerviz');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousemove', function(evt) {
        onMouseMove(canvas, evt);
    }, false);
    canvas.addEventListener('mousedown', function(evt) {
        onMouseDown(canvas, evt);
    }, false);
    canvas.addEventListener('mouseup', function(evt) {
        onMouseUp(canvas, evt);
    }, false);
    function onMouseOut(canvas, evt) {
        onMouseOut(canvas, evt);
    }
    canvas.addEventListener('keyup', function(evt) {
        onKeyUp(canvas, evt);
    }, false);
    var fc = {
        number: 0,
        position: {
            x: 300,
            y: 300
        }
    };
    //fc.image = new Image();
    //fc.image.src = "resources/mixercalc/fc.png";  //not rendered, but fc still used for calculations
    motors.push(fc);
    cogImage = new Image();
    cogImage.src = "resources/mixercalc/cog.png";
    addMotorsRadial(4);
    run = true;  //moved run = true here, so that it resets animation speed.
    initMotorImages();
    updateMotorConstraintsSatisfied();
    animate();

    canvas.focus();   //fair spot here (problem is cannot 100% steal focus, else input caret lost)
    console.log("debug: mixercalc: canvas.focus");

});

function canvasPosToMixerPos(canvasPos) {
    var cx = (canvasPos.x - canvas.width / 2) / limit;
    var cy = (canvasPos.y - canvas.width / 2) / limit;
    return {
        x: cx,
        y: cy
    };
}

function mixerPosToCanvasPos(mixvalue) {
    var mx = canvas.width / 2 + mixvalue.x * limit;
    var my = canvas.height / 2 + mixvalue.y * limit;
    return {
        x: mx,
        y: my
    };
}

function motorPosToMixerPos(motorPos) {
    var fcpos = motors[0].position;
    var vx = (motorPos.x - fcpos.x) * scale;
    var vy = (motorPos.y - fcpos.y) * scale;
    return {
        x: vx,
        y: vy
    };
}

function mixerPosToMotorPos(mixvalue) {
    var fcpos = motors[0].position;
    var mx = (mixvalue.x / scale) + fcpos.x;
    var my = (mixvalue.y / scale) + fcpos.y;
    return {
        x: mx,
        y: my
    };
}

function onMouseMove(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    mousePos = {
        x: evt.clientX - rect.left,
        y: canvas.height - (evt.clientY - rect.top)
    };
    //console.log("debug: mixercalc: "+mixerPosToMotorPos(canvasPosToMixerPos(mousePos)));
    //console.log("debug: mixercalc: "+ motors[1].position );
    if (!draggingMotor) {
        // check which motor the mouse is over
        highlightedMotor = null;
        var bestDist = 100000;
        for (var i = 1; i < motors.length; i++) {
            var motor = motors[i];
            /*if (motor.constraints > 0) {
        continue;
        }*/
            var motorPos = mixerPosToCanvasPos(motor.mixvalue);
            var d = dist(motorPos, mousePos);
            if (d < 50 && d < bestDist) {
                bestDist = d;
                highlightedMotor = i;
            }
        }
    } else {
        var motor = motors[highlightedMotor];
        //motor.mixvalue = canvasPosToMixerPos(mousePos);
        motor.position = mixerPosToMotorPos(canvasPosToMixerPos(mousePos));
    }
}

function onMouseOut(canvas, evt) {
    highlightedMotor = null;
}

function onMouseDown(canvas, evt) {
    if (!highlightedMotor || draggingMotor) return;
    draggingMotor = true;
}

function onMouseUp(canvas, evt) {
    draggingMotor = false;
    mousePos = null;
}

function onKeyUp(canvas, evt) {
    var motorPos = mixerPosToMotorPos(canvasPosToMixerPos(mousePos));
    var nextMotorNumber = motors.length;

    switch (evt.keyCode) {
        case 37:  //left
            motors.push({
                number: nextMotorNumber,
                direction: 1,
                position: motorPos
            });
            initMotorImages();
            updateMotorConstraintsSatisfied();
            break;
        case 39:  //right
            motors.push({
                number: nextMotorNumber,
                direction: 0,
                position: motorPos
            });
            initMotorImages();
            updateMotorConstraintsSatisfied();
            break;
        case 46: //delete
        case 68: // d
            if (!draggingMotor && highlightedMotor) {
                motors.splice(highlightedMotor, 1);
                for (var i = 0; i < motors.length; i++) {
                    motors[i].number = i;
                }
                for (var i = relations.length - 1; i >= 0; i--) {
                    if (relations[i].a >= motors.length || relations[i].b >= motors.length) {
                        relations.splice(i, 1);
                    }
                }
                updateMotorConstraintsSatisfied();
                doReparse();
            }
            break;
        case 38: //38 = up
        case 82: //82 = r
            if (!draggingMotor && highlightedMotor) {
                var motor = motors[highlightedMotor];
                motor.direction = 1 - motor.direction;
                if (motor.direction == 1) {
                    motor.image.src = "resources/mixercalc/emu-prop-cw.png";
                } else {
                    motor.image.src = "resources/mixercalc/emu-prop-ccw.png";
                }
            }
            break;
    }
    console.log("debug: mixercalc: keyup: "+evt.keyCode)
}

function reverseAllMotors() {
    for (var i = 0; i < motors.length; i++) {
        var motor = motors[i];
        motor.direction = 1 - motor.direction;
        if (motor.direction == 1) {
            motor.image.src = "resources/mixercalc/emu-prop-cw.png";
        } else {
            motor.image.src = "resources/mixercalc/emu-prop-ccw.png";
        }
    }
}

//no longer used:
//function onCommandTypeChanged() {
//    commandType = $("#commandtype").val();
//    //console.log("debug: mixercalc: "+commandType);
//    updateMmixCommands();
//    if (commandType == "cf1.9" || commandType == "cf1.10") $("#cfextra").show(); //"remember save"
//    else $("#cfextra").hide();
//    if (commandType == "arducopter") $("#arducopterextra").show();
//    else $("#arducopterextra").hide();
//}


function mixCommandCopyClipboardFunc() {
    // $("#commands").select();   //jquery   //works for text area only, so need more logic for pre/div
    var node = document.getElementById("commands");
        //chrome only solution
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
    document.execCommand('copy');   //copy to clipboard
    document.getElementById("mixCommandCopyButton").textContent="------- Copied -------";
}

function mixCommandCopyClipboardOutFunc() {
    document.getElementById("mixCommandCopyButton").textContent="Copy to Clipboard";
}

