package com.senux.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register native custom plugins before initializing the bridge
        registerPlugin(VideoTranscoderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
