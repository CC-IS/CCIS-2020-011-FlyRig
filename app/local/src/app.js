'use strict';

var remote = require('electron').remote;

var process = remote.process;

var config = remote.getGlobal('config');

var dialog = remote.dialog;
//remote.getCurrentWindow().closeDevTools();

class StimCue {
  constructor(cueArray){
    var _this = this;
    if(cueArray) _this.set(cueArray);
  }

  set(cueArray){
    var odorCodes = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
    }

    var getVal = str => (!Number.isNaN(parseFloat(str))?parseFloat(str):0);
    function bit_set(num, bit){
        return num | 1<<bit;
    }

    var _this = this;
    _this.time = getVal(cueArray[0])*1000;
    _this.quads = cueArray.slice(1,5).map(getVal);
    _this.amplitude = getVal(cueArray[5]);
    _this.frequency = getVal(cueArray[6]);
    _this.pulseLength = getVal(cueArray[7]);
    _this.leftOdor = 0;
    _this.rightOdor = 0;
    if(odorCodes[cueArray[8][0]]) _this.leftOdor = odorCodes[cueArray[8][0]];
    if(odorCodes[cueArray[9][0]]) _this.rightOdor = odorCodes[cueArray[9][0]];
  }

  run(control){
    control.stimulate(this.frequency, this.amplitude, this.pulseLength, this.quads);
    var ro = this.rightOdor;
    var lo = this.leftOdor;
    var outNum = ((!!ro)<<(ro + 3)) | (!!lo)<<(lo - 1);
    control.setOutputs(outNum);
  }
};

class CueList extends Array{
  constructor(ctrl){
    super();

    this.control = ctrl;
  }

  start(cb){
    var _this = this;
    _this.endCB = cb;
    _this.sort((a,b)=>a.time-b.time);
    _this.startTime = Date.now();
    _this.schedule(0);
  }

  stop(){
    clearTimeout(this.timeout);
  }

  schedule(index){
    var _this = this;
    if(_this[index]){
      _this.timeout = setTimeout(()=>{
        _this[index].run(_this.control);
        _this.schedule(index + 1);
      }, _this[index].time - (Date.now() - _this.startTime))
    } else if(_this.endCB) _this.endCB();
  }

  // getValueByKey(key,index){
  //   var _this = this;
  //   var ret = '';
  //   if(Number.isNaN(_this[index][key]) && index>0) ret = _this.getValueByKey(key,index - 1);
  //   else ret = _this[index][key];
  //   return ret;
  // }
}

var obtains = [
  './src/controller.js',
  './src/camera.js',
  'µ/components/progress.js',
  'os',
  'path'
];

obtain(obtains, ({ LightControl }, {Camera}, {ProgressRing}, os, path)=> {

  exports.app = {};

  exports.app.start = ()=> {

    console.log('started');

///////////////////////////////////////////////////
// Create the light controller

    var cam = µ('cam-era')[0];

    filePath.value = path.join(os.homedir());//os.homedir(), '/Documents/FlyVideos');

    var note = text=>Notes.textContent = text;

    var recordTimer = null;
    var progressInt = null;

    var editingCue = null;

    cam.getSourceNames(devs=>{
      devs.forEach(dev => {
        if(dev.kind == 'videoinput'){
          var opt = µ('+option', µ('#cameraSource'));
          opt.value = dev.deviceId;
          opt.textContent = dev.label;
        }
      });

    })

    cam.options.video = {
      width: {min: 640, ideal: 2160 },
      height: {min: 480, ideal: 2160 },
      frameRate: {exact: 30}
    };

    cam.video.addEventListener('loadedmetadata', ()=> {
      widthSelect.value = wid_note.textContent = cam.video.videoWidth;
      heightSelect.value = hgt_note.textContent = cam.video.videoHeight;
    });

      // _this.canvas.width = _this.video.videoWidth;
      // _this.canvas.height = _this.video.videoHeight;

    var decoded = 0;
    var startTime = Date.now();

    setInterval(()=>{
      FR_note.textContent = (cam.video.webkitDecodedFrameCount - decoded).toFixed(2);
      decoded = cam.video.webkitDecodedFrameCount;
    }, 1000);
    //cam.setSourceFromLabel('USB Camera (05a3:9422)').then(cam.startStream.bind(cam));

    //cam.startStream();

    var control = new LightControl(config.io);
    var cues = new CueList(control);

    // set warning flags for if the device isn't connected.
    control.onPortNotFound = ()=>{
      note('Please connect the control board.');
    }

    if(control.portNotFound) note('Please connect the control board.');


    var prog = µ('progress-ring')[0];
    prog.progress = 0;

    µ('.title').forEach(title => {
      var reveal = µ('.reveal', title)[0];
      title.onclick = ()=>{
        reveal.classList.toggle("rotate90");
        µ('.opts',title.parentElement)[0].classList.toggle('open');
      }
    });

    blRange.onchange = (e)=>{
      var _this = e.target;
      backlight.value = _this.value;
      control.setBacklight(backlight.value);
    }

    backlight.onchange = (e)=>{
      var _this = e.target;
      blRange.value = _this.value;
      control.setBacklight(backlight.value);
    }


// Once the controller is ready, enable some controls, start the temperature monitoring

    var manualOn = ()=>{
      var pins = [];
      for(var i=1; i<5; i++){
        pins.push(µ(`#quad${i}`).checked?1:0);
      }
      control.stimulate(parseInt(freqSelect.value), parseInt(ampSelect.value), parseInt(lenSelect.value), pins);
      //control.setBacklight(backlight.value);
      control.setOutputs(rightOdor.value | leftOdor.value);
    }

    var manualOff = ()=>{
      control.stimulate(0, 0, 0, [0,0,0,0]);
      //control.setBacklight(0);
      control.setOutputs(0);
    }

    var recordStop = ()=>{
      if(cam.isRecording){
        clearInterval(recInt);
        cam.stop();
        µ('#indicator').style.display = 'none';
        timeStamp.style.display = 'none';
        clearInterval(progressInt);
        clearTimeout(recordTimer);
        prog.progress = 0;
        note('Saving file...');
      }
    }

    var recordStart = ()=>{
      if(!cam.isRecording){
        note('Recording...');
        var time = µ('#durationSelect').value;
        cam.record();
        µ('#indicator').style.display = 'inline-block';
        var startTime = Date.now();
        timeStamp.style.display = 'block';
        recInt = setInterval(()=>{
          var tmr = Date.now() - startTime;
          let hr = String(Math.floor(tmr/3600000.)).padStart(2,'0');
          let min = String(Math.floor(tmr/60000.)%60).padStart(2,'0');
          let sec = String(Math.floor(tmr/1000.)%60).padStart(2,'0');
          let frac = String(Math.floor(tmr%1000/10)).padStart(2,'0');
          timeStamp.textContent = `${hr}:${min}:${sec}.${frac}`;
        }, 100);
        if(time){
          progressInt = setInterval(()=>{
            prog.progress = (Date.now() - startTime)/(time*1000);
          },250);
          recordTimer = setTimeout(recordStop, 1000 * time);
        }
      }
    }

    cam.beforeSave = ()=>{
      cam.metadata = {};
      cam.addMet = 'Base filename,'+cam.baseName+'\n';
      cam.addMet += 'Time (sec),LED1,LED2,LED3,LED4,Amplitude,Frequency,Pulse width,Odor_L,Odor_R\n';
      if(cues.length){
        cues.forEach((cue, i) => {
          cam.addMet += cue.time/1000+","+cue.quads[0]+','+cue.quads[1]+','+cue.quads[2]+','+cue.quads[3]+',';
          cam.addMet += cue.amplitude+','+cue.frequency+','+cue.pulseLength+',';
          cam.addMet += (cue.leftOdor?String.fromCharCode(64+cue.leftOdor):'')+',';
          cam.addMet += (cue.rightOdor?String.fromCharCode(64+cue.rightOdor):'')+'\n';
        });
      }
      cam.addMet += 'end\n\nMetadata\n';
      let data = µ('div', Metadata);
      for (var i = 0; i < data.length; i++) {
        var key = µ('label', data[i])[0].textContent;
        var val = µ('input', data[i])[0].value;
        cam.metadata[key] = val;
      }
    }

    cam.onSaveProgress = (perc)=>{
      progIn.style.width = Math.floor(perc * 100) + '%';
    }

    cam.onSaveEnd = ()=>{
      progIn.style.width = '0';
      note('Saved video file.');
    }

    control.onready = ()=>{
      //µ('#notes').textContent = 'Controller Ready';

      control.on('note', msg=>{

      });

      µ('#Set').onclick = ()=>{
        manualOn();
        if(stimTime.value) setTimeout(manualOff, stimTime.value * 1000);
      }

      Off.onclick = manualOff;

      Mom.onmousedown = manualOn;

      Mom.onmouseup = manualOff;

    }

    camApply.onclick = ()=>{
      if(cameraSource.value != '0') cam.options.video.deviceId = cameraSource.value;
      cam.options.video.frameRate = {exact: rateSelect.value};
      cam.options.video.width.exact = parseInt(widthSelect.value);
      cam.options.video.height.exact = parseInt(heightSelect.value);
      cam.startStream();
    }

    let caps = navigator.mediaDevices.getSupportedConstraints();

    ExpoSlide.disabled = !caps.exposureMode;
    BrightSlide.disabled = !caps.brightness;

    BrightSlide.onchange = ()=>{
      let track = cam.stream.getVideoTracks()[0];
      track.applyConstraints({
        advanced: [{brightness: BrightSlide.value}]
      });
    }

    ExpoSlide.onchange = ()=>{
      let track = cam.stream.getVideoTracks()[0];
      track.applyConstraints({
        advanced: [{exposureMode: "manual",exposureTime: ExpoSlide.value}]
      });
    }

    var optsFromCues = ()=>{
      cueList.innerHTML = '';
      cues.forEach((item,i) => {
        let opt = µ('+option',cueList);
        opt.value = i;
        var ttlStr = `Cue ${String(i).padStart(2, '0')}: ${String(item.time / 1000).padStart(4,'\xa0')} s`;
        opt.textContent = ttlStr;
      });
    }

    Delete.onclick = ()=>{
      µ('option:checked',cueList).forEach((cue, i) => {
        cueList.removeChild(cue);
        cues.splice(i,1);
      });
    };

    Add.onclick = ()=>{
      editingCue = new StimCue();
      editingCue.new = true;
      editOverlay.style.display = 'block';
      cueTime.value = '';
      ampEd.value = '';
      freqEd.value = '';
      lenEd.value = '';
      edLeftOdor.selectedIndex = 0;
      edRightOdor.selectedIndex = 0;
      for (var i = 0; i < 4; i++) {
        µ(`#edQuad${i+1}`).checked = false;
      }
    }

    Edit.onclick = ()=>{
      var ind = µ('option:checked',cueList)[0].value;
      editingCue = cues[ind];
      cueTime.value = editingCue.time/1000;
      ampEd.value = editingCue.amplitude;
      freqEd.value = editingCue.frequency;
      lenEd.value = editingCue.pulseLength;
      edLeftOdor.selectedIndex = editingCue.leftOdor;
      edRightOdor.selectedIndex = editingCue.rightOdor;
      for (var i = 0; i < 4; i++) {
        µ(`#edQuad${i+1}`).checked = editingCue.quads[i];
      }
      editOverlay.style.display = 'block';
    }

    Save.onclick = ()=>{
      var opts = [];
      opts.push(cueTime.value);
      for (var i = 0; i < 4; i++) {
        opts.push(µ(`#edQuad${i+1}`).checked?1:0);
      }
      opts.splice(5, 0, ampEd.value, freqEd.value, lenEd.value, edLeftOdor.value, edRightOdor.value);
      editingCue.set(opts);
      if(editingCue.new){
        editingCue.new = false;
        cues.push(editingCue);
      }
      cues.sort((a,b)=>a.time - b.time);
      optsFromCues();
      editOverlay.style.display = 'none';
    }

    Cancel.onclick = ()=>{
      editOverlay.style.display = 'none';
    }

    Run.onclick = ()=>{
      cues.start(()=>{
        cues.stop();
        recordStop();
        control.stimulate(0, 0, 0, [0,0,0,0]);
        //control.setBacklight(0);
        control.setOutputs(0);
      });
      if(AutoRecord.checked) recordStart();
      note('Running queued actions...');
    }

    Halt.onclick = ()=>{
      cues.stop();
      recordStop();
      control.stimulate(0, 0, 0, [0,0,0,0]);
      //control.setBacklight(0);
      control.setOutputs(0);
    }

    µ('.reveal',auto)[0].click();

    var recInt = null;

    Record.onclick = ()=>{
      recordStart();
    }

    Stop.onclick = ()=>{
      recordStop();
    }

    SetPath.onclick = ()=>{
      dialog.showOpenDialog({
        title: 'Select the File Path to save',
        defaultPath: filePath.value,
        buttonLabel: 'Set Filepath',
        properties:["openDirectory"]
      }).then(path => {
        if(!path.canceled){
          filePath.value = path.filePaths.toString();
          cam.filePath = filePath.value;
        }

      }).catch(err => {
          console.log(err)
      });
    }

    filePath.onchange = ()=>{
      cam.filePath = filePath.value;
    }

    baseName.onchange = ()=>{
      if(baseName.value.includes('\\') || baseName.value.includes('/')) baseName.value.replace(/\//g, '|');
      cam.baseName = baseName.value;
    }

    dataFile.onclick = (e) => {
      dataFile.value = '';
    }

    dataFile.onchange = (e)=>{
        if(e.target.files.length){
          cues = new CueList();
          const reader = new FileReader();
          reader.addEventListener('load', (event) => {
            var lines = event.target.result.split('\n').map(item => item.split(','));

            cam.baseName = baseName.value = lines[0][1];

            var mode = 'cues';
            Metadata.innerHTML = '';

            for (var i = 2; i < lines.length; i++) {
              let cells = lines[i];
              if(mode == 'cues'){
                if(cells[0] == 'end') mode = 'inter';
                else {
                  //console.log(new StimCue(cells));
                  cues.push(new StimCue(cells));
                }
              } else if(mode == 'meta'){
                let opt = µ('+div', Metadata);
                let lbl = µ('+label', opt);
                let inpt = µ('+input', opt);
                lbl.textContent = cells[0];
                inpt.value = cells[1];
              } else if(mode == 'inter' && cells[0] == 'Metadata') mode='meta';


            }

            optsFromCues();

            //tempControl.loadData(lines);
          });
          reader.readAsText(e.target.files[0]);
        }
      }

    document.onkeypress = (e)=> {

    };
  };

  provide(exports);
});
