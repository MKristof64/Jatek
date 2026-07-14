package hu.mkristof64.azivosjatek;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ApplicationContextTest {
    @Test
    public void applicationUsesExpectedPackageName() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals("hu.mkristof64.azivosjatek", appContext.getPackageName());
    }
}
