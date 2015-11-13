
loadAPI(1);
host.defineController("DJ Tech Tools", "Midi Fighter Twister", "1.0", "d6b9adc4-81d0-11e5-8bcf-feff819cdc9f");
host.defineMidiPorts(1, 1);
host.addDeviceNameBasedDiscoveryPair(["Midi Fighter Twister"], ["Midi Fighter Twister"]);

load("MidiFighterTwister.constants.js")
load("MidiFighterTwister.mixer.js")
load("MidiFighterTwister.MelodicSequencer.js")
load("MidiFighterTwister.DrumSequencer.js")

function init()
{
	host.getMidiInPort(0).setMidiCallback(onMidi);
    noteInput = host.getMidiInPort(0).createNoteInput("Midi Fighter Twister", "80????", "90????");
    noteInput.setShouldConsumeEvents(false);
	
	trackBank = host.createMainTrackBank(8, 11, 8);
    for(var t=0; t<8; t++)
    {
		var track = trackBank.getChannel(t);
		track.getVolume().addValueObserver(126, getTrackObserverFunc(t, volume));
		track.getPan().addValueObserver(126, getTrackObserverFunc(t, pan));
		
		for(var s=0; s<11; s++)
			{
			track.getSend(s).addValueObserver(126, getSendObserverFunc(t, s));
			}
			
		track.getMute().addValueObserver(getTrackObserverFunc(t, mute));
		track.getSolo().addValueObserver(getTrackObserverFunc(t, solo));
		track.addIsSelectedInMixerObserver(getTrackObserverFunc(t, isSelected));
		track.addColorObserver(getTrackObserverFunc(t, color));
		track.getArm().addValueObserver(getTrackObserverFunc(t, arm));
    }
	
	trackBank.addCanScrollTracksUpObserver(function(canScroll)
   {
      mixerPage.canScrollTracksUp = canScroll;
   });
   trackBank.addCanScrollTracksDownObserver(function(canScroll)
   {
      mixerPage.canScrollTracksDown = canScroll;
   });
   
	for (var i=0; i<SEQ_STEPS; i++)
	{
		stepData[i] = initArray(false, SEQ_KEYS);
	}
   
    cursorClip = host.createCursorClip(SEQ_STEPS, SEQ_KEYS);
    cursorClip.addStepDataObserver(onStepExists);
    cursorClip.addPlayingStepObserver(onStepPlaying);
   
	changeEncoderBank(ENCODERBANK);
    trackBank.setChannelScrollStepSize(channelStepSize);
	setActivePage(mixerPage);
}

function setActivePage(page) //TODO: make notification show active page within mode
{
   var isInit = activePage == null;

   if (page != activePage)
   {
      activePage = page;
      if (!isInit)
      {
         host.showPopupNotification(page.title);
		 
      }
   }
}

function getSendObserverFunc(t, s)
{
	return function(value)
	{
	sendArray[t][s] = value;
	}
}

function getTrackObserverFunc(track, varToStore)
{	
	if (varToStore == color)
	{
		return function(r, g, b)
		{
			varToStore[track] = handleColor(r,g,b);
		}
	}
	else
	{
		return function(value)
		{
			varToStore[track] = value;
		}
	}
}

function onMidi(status, data1, data2)
{
	printMidi(status, data1, data2);
    var isActive = data2 > 0;
	var isPressed = data1 > 0;
	
	if (status == statusType.ENCODER_TURN)
	{
		encoderNum = data1;
		encoderValue = data2;
		activePage.onEncoderTurn(isActive);
	}
	
	if (status == statusType.ENCODER_PRESS && data2 == 127) //data2 == 127 for encoder press
	{
		encoderNum = data1;
		encoderValue = data2;
		activePage.onEncoderPress(isActive);
	}
	
	if (status == statusType.ENCODER_PRESS && data2 == 127) //data2 == 0 for encoder release
	{
		encoderNum = data1;
		encoderValue = data2;
		activePage.onEncoderRelease(isActive);
	}
	
	if (status == statusType.SIDEBUTTON_PRESS)
	{
		switch(data1)
		{
		case SIDE_BUTTON.LH_BOTTOM:
            activePage.onLeftBottom(isPressed);
			break;
		case SIDE_BUTTON.LH_MIDDLE:
			activePage.onLeftMiddle(isPressed);
			break
		case SIDE_BUTTON.LH_TOP:
			activePage.onLeftTop(isPressed);
			break;
		case SIDE_BUTTON.RH_BOTTOM:
            activePage.onRightBottom(isPressed);
			break;
		case SIDE_BUTTON.RH_MIDDLE:
			activePage.onRightMiddle(isPressed);
			break
		case SIDE_BUTTON.RH_TOP:
			activePage.onRightTop(isPressed);
			break;
		}
	}

	if (status == statusType.SIDEBUTTON_RELEASE)
	{
		
	}
}

function page()
{
	this.canScrollLeft = false;
	this.canScrollRight = false;
}

page.prototype.updateOutputState = function()
{
};

function clear()
{
   for(var i=0; i<64; i++)
   {
      pendingRGBLEDs[i] = 0;
	  pendingRGBSTROBEs[i] = 0
	  pending11segLEDs[i] = 0;
   }
}

function flush()
{
	activePage.updateOutputState();
	flushLEDs();
}

function setRGBLED(loc, color, strobe)
{
	pendingRGBLEDs[loc] = color;
	pendingRGBSTROBEs[loc] = strobe;
}

function set11segLED(loc, value)
{
	pending11segLEDs[loc] = value;
}

function flushLEDs()
{
   var changedRGBCount = 0;
   var changedRGBStrobeCount = 0;
   var changed11segCount = 0;
   
   for(var i=0; i<64; i++)
   {
      if (pendingRGBLEDs[i] != activeRGBLEDs[i]) changedRGBCount++;
	  if (pending11segLEDs[i] != active11segLEDs[i]) changed11segCount++;
	  if (pendingRGBSTROBEs[i] != activeRGBSTROBEs[i]) changedRGBStrobeCount++;
   }

   if (changedRGBCount == 0 && changed11segCount == 0 && changedRGBStrobeCount == 0) return;
   
	for(var i = 0; i<64; i++)
		{
			if (pendingRGBLEDs[i] != activeRGBLEDs[i])
			{
	            activeRGBLEDs[i] = pendingRGBLEDs[i];
	            var color = activeRGBLEDs[i];
				sendMidi(177, i, color);
			}
			
			if (pendingRGBSTROBEs[i] != activeRGBSTROBEs[i])
			{
				activeRGBSTROBEs[i] = pendingRGBSTROBEs[i];
	            var strobe = activeRGBSTROBEs[i];
				sendMidi(178, i, strobe);
			}
			
			if (pending11segLEDs[i] != active11segLEDs[i])
			{
	            active11segLEDs[i] = pending11segLEDs[i];
	            var value = active11segLEDs[i];
				sendMidi(176, i, value);
			}
		}
}

function handleColor(red, green, blue)
{
    for (var i = 0; i < trackColors.length; i++)
    {
        var currentColor = trackColors[i];
        if (Math.abs (currentColor[0] - red ) < 0.0001 && Math.abs (currentColor[1] - green) < 0.0001 && Math.abs (currentColor[2] - blue) < 0.0001)
		{
        return currentColor[3];
		}
    }    
};

function changeEncoderBank(bank)
{
	sendMidi(147, bank, 127);
}

function onStepExists (step, key, exists)
{
	stepData[step][key] = exists;
}

function isAnyStepTrue (step, array)
{
	for (k=0; k<SEQ_KEYS; k++)
	{
		if (array[step][k] === true)
		{
			return true;
		}
	}
	return false;
}

function getFirstKey(step, array)
{
	for (k=0; k<SEQ_KEYS; k++)
	{
		if (array[step][k] === true)
		{
			return k;
		}
	}
	return 0;
}

function onStepPlaying(step)
{
	playingStep = (step);
}