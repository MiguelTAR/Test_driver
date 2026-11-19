import { SessionControls } from "@/components/session-controls";
import { ThemedView } from "@/components/themed-view";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SessionScreen() {
    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <SessionControls />
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    safeArea: {flex: 1, alignItems: 'center', justifyContent:'center'},

});