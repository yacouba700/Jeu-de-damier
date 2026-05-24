// --- React Native Expo standalone App.tsx using Tailwind / NativeWind ---
// ⚠️ NOTE POUR EXPO SNACK : Pour corriger l'erreur de dépendance, allez sur le menu de gauche/bas 
// de votre Snack Expo, dans la section "Dependencies", cliquez sur "Add Dependency" et cherchez :
// "socket.io-client" (ajoutez la version recommandée).
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView, 
  ActivityIndicator, 
  FlatList 
} from 'react-native';
import { io } from 'socket.io-client';

const BACKEND_URL = "https://ais-dev-7aca3drt22vqcbwvrp5hzs-512137788723.europe-west2.run.app"; // URL dynamique de l'Arène live de Dames Mali

export default function App() {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState(5000);
  const [screen, setScreen] = useState('login'); // login | home | play | tournament
  const [tournaments, setTournaments] = useState([]);
  const [selectedTour, setSelectedTour] = useState(null);
  
  const initBoard10x10 = () => {
    const b = Array(10).fill(null).map(() => Array(10).fill(null));
    let id = 1;

    // Dark pieces (Red) top 4 rows
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        if ((r + c) % 2 === 1) {
          b[r][c] = { id: 'red_' + (id++), row: r, col: c, player: 'red', isKing: false };
        }
      }
    }

    // Light pieces (White) bottom 4 rows
    for (let r = 6; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if ((r + c) % 2 === 1) {
          b[r][c] = { id: 'white_' + (id++), row: r, col: c, player: 'white', isKing: false };
        }
      }
    }
    return b;
  };

  const [board, setBoard] = useState(() => initBoard10x10());
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [wager, setWager] = useState(1000);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  
  const socketRef = useRef(null);

  useEffect(() => {
    // Connexion au serveur Socket.io multi-joueurs de l'Arène
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('match:start', (session) => {
      setBoard(session.board);
      setCurrentPlayer(session.currentPlayer);
      setScreen('play');
      Alert.alert("Match Trouvé !", "Partie de dames 10x10 lancée avec mise de " + session.wager + " F CFA");
    });

    socketRef.current.on('game:updated', (newSession) => {
      setBoard(newSession.board);
      setCurrentPlayer(newSession.currentPlayer);
    });

    socketRef.current.on('tournaments:updated', (updatedList) => {
      setTournaments(updatedList);
      if (selectedTour) {
        const fresh = updatedList.find(t => t.id === selectedTour.id);
        if (fresh) setSelectedTour(fresh);
      }
    });

    socketRef.current.on('tournament:log', (log) => {
      setLogs(prev => [...prev, log.text]);
    });

    socketRef.current.on('game:over', (data) => {
      Alert.alert("Fin de Combat 👑", data.winnerUsername + " a gagné ! Gain Net: " + data.netReward + " F CFA");
      setScreen('home');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [selectedTour]);

  const handleConnect = () => {
    if (!username.trim()) return;
    const generatedId = "usr_" + Math.random().toString(36).substr(2, 5);
    setUserId(generatedId);
    socketRef.current.emit('auth:init', generatedId);
    setScreen('home');
  };

  const handleRegisterTournament = (tournamentId) => {
    fetch(BACKEND_URL + "/api/tournaments/register", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tournamentId })
    })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        Alert.alert("Erreur", data.error);
      } else {
        Alert.alert("Succès ✨", "Inscription validée au tournoi !");
        setBalance(data.balance);
      }
    })
    .catch(() => Alert.alert("Erreur", "Connexion réseau impossible."));
  };

  const handleSquareClick = (r, colIndex) => {
    const piece = board[r][colIndex];
    
    // Select own piece
    if (piece && piece.player === currentPlayer) {
      setSelectedPiece({ r, c: colIndex });
      
      const targets = [];
      const directions = [
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: 1, dc: 1 }
      ];
      
      const drNormal = piece.player === 'white' ? -1 : 1;
      
      directions.forEach(({ dr, dc }) => {
        if (piece.isKing) {
          for (let step = 1; step <= 3; step++) {
            const tr = r + dr * step;
            const tc = colIndex + dc * step;
            if (tr >= 0 && tr < 10 && tc >= 0 && tc < 10) {
              const targetPiece = board[tr][tc];
              if (!targetPiece) {
                targets.push({ to: { r: tr, c: tc }, captures: [] });
              } else if (targetPiece.player !== piece.player) {
                const lr = tr + dr;
                const lc = tc + dc;
                if (lr >= 0 && lr < 10 && lc >= 0 && lc < 10 && !board[lr][lc]) {
                  targets.push({ to: { r: lr, c: lc }, captures: [{ r: tr, c: tc }] });
                }
                break;
              } else {
                break;
              }
            }
          }
        } else {
          if (dr === drNormal) {
            const tr = r + dr;
            const tc = colIndex + dc;
            if (tr >= 0 && tr < 10 && tc >= 0 && tc < 10 && !board[tr][tc]) {
              targets.push({ to: { r: tr, c: tc }, captures: [] });
            }
          }
          const enemyR = r + dr;
          const enemyC = colIndex + dc;
          const landingR = r + 2 * dr;
          const landingC = colIndex + 2 * dc;
          if (landingR >= 0 && landingR < 10 && landingC >= 0 && landingC < 10) {
            const enemy = board[enemyR][enemyC];
            const landing = board[landingR][landingC];
            if (enemy && enemy.player !== piece.player && !landing) {
              targets.push({ to: { r: landingR, c: landingC }, captures: [{ r: enemyR, c: enemyC }] });
            }
          }
        }
      });
      
      setLegalMoves(targets);
      return;
    }

    // Execute Move
    const matched = legalMoves.find(m => m.to.r === r && m.to.c === colIndex);
    if (matched && selectedPiece) {
      const newBoard = board.map(row => [...row]);
      const activePiece = newBoard[selectedPiece.r][selectedPiece.c];
      
      newBoard[selectedPiece.r][selectedPiece.c] = null;
      
      const isPromo = (activePiece.player === 'white' && r === 0) || (activePiece.player === 'red' && r === 9);
      newBoard[r][colIndex] = {
        ...activePiece,
        row: r,
        col: colIndex,
        isKing: activePiece.isKing || isPromo
      };
      
      matched.captures.forEach(cap => {
        newBoard[cap.r][cap.c] = null;
      });

      setBoard(newBoard);
      setSelectedPiece(null);
      setLegalMoves([]);

      if (socketRef.current) {
        socketRef.current.emit('game:move', { 
          gameId: "active_match",
          move: {
            from: { r: selectedPiece.r, c: selectedPiece.c },
            to: { r, c: colIndex },
            capturedPieces: matched.captures
          }
        });
      }

      const nextTurn = currentPlayer === 'white' ? 'red' : 'white';
      setCurrentPlayer(nextTurn);

      if (nextTurn === 'red') {
        setTimeout(() => {
          let aiMoveMade = false;
          for (let ri = 0; ri < 10; ri++) {
            for (let ci = 0; ci < 10; ci++) {
              const p = newBoard[ri][ci];
              if (p && p.player === 'red') {
                const targets = [
                  { dr: 1, dc: -1 },
                  { dr: 1, dc: 1 },
                  { dr: -1, dc: -1 },
                  { dr: -1, dc: 1 }
                ];
                for (const d of targets) {
                  const er = ri + d.dr;
                  const ec = ci + d.dc;
                  const lr = ri + 2 * d.dr;
                  const lc = ci + 2 * d.dc;
                  
                  if (lr >= 0 && lr < 10 && lc >= 0 && lc < 10) {
                    const enemy = newBoard[er][ec];
                    const land = newBoard[lr][lc];
                    if (enemy && enemy.player === 'white' && !land) {
                      newBoard[ri][ci] = null;
                      newBoard[lr][lc] = { ...p, row: lr, col: lc, isKing: p.isKing || lr === 9 };
                      newBoard[er][ec] = null;
                      setBoard(newBoard);
                      setCurrentPlayer('white');
                      aiMoveMade = true;
                      break;
                    }
                  }
                }
                if (aiMoveMade) break;

                for (const d of [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }]) {
                  const tr = ri + d.dr;
                  const tc = ci + d.dc;
                  if (tr >= 0 && tr < 10 && tc >= 0 && tc < 10 && !newBoard[tr][tc]) {
                    newBoard[ri][ci] = null;
                    newBoard[tr][tc] = { ...p, row: tr, col: tc, isKing: p.isKing || tr === 9 };
                    setBoard(newBoard);
                    setCurrentPlayer('white');
                    aiMoveMade = true;
                    break;
                  }
                }
                if (aiMoveMade) break;
              }
            }
            if (aiMoveMade) break;
          }
        }, 800);
      }
    } else {
      setSelectedPiece(null);
      setLegalMoves([]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {screen === 'login' ? (
        <View style={styles.content}>
          <Text style={styles.flagSymbol}>🇲🇱</Text>
          <Text style={styles.title}>Dames Mali Standalone</Text>
          <Text style={styles.sub}>Fédération Mobile Expo Go</Text>
          
          <TextInput
            placeholder="Entrez votre Pseudo..."
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
          />
          <TouchableOpacity onPress={handleConnect} style={styles.btnGold}>
            <Text style={styles.btnText}>S'AUTHENTIFIER</Text>
          </TouchableOpacity>
        </View>
      ) : screen === 'home' ? (
        <View style={styles.content}>
          <Text style={styles.title}>Arène de Bamako 🇲🇱</Text>
          <Text style={styles.balance}>Solde : {balance} F CFA</Text>
          
          <TouchableOpacity 
            onPress={() => {
              setBoard(initBoard10x10());
              setCurrentPlayer('white');
              setScreen('play');
            }} 
            style={[styles.btnGold, { marginBottom: 15 }]}
          >
            <Text style={styles.btnText}>🔬 JOUER CONTRE L'IA ROBOT (ENTRAÎNEMENT)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setScreen('tournament')} 
            style={styles.btnGold}
          >
            <Text style={styles.btnText}>🏆 TROUVER UN TOURNOI CHAMPIONNAT</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setScreen('login')} 
            style={[styles.btnSec, { marginTop: 15 }]}
          >
            <Text style={styles.btnSecText}>Retour</Text>
          </TouchableOpacity>
        </View>
      ) : screen === 'tournament' ? (
        <ScrollView style={styles.scroller}>
          <Text style={styles.headerTitle}>🏆 Championnats de Dames Mali</Text>
          {tournaments.length === 0 ? (
            <Text style={styles.subText}>Aucun tournoi actif sur le serveur.</Text>
          ) : (
            tournaments.map((t) => (
              <View key={t.id} style={styles.tourCard}>
                <Text style={styles.tourName}>{t.name}</Text>
                <Text style={styles.tourMeta}>Mise: {t.entryFee} F CFA | Inscrit: {t.registeredUserIds.length}/{t.maxPlayers}</Text>
                <TouchableOpacity 
                  onPress={() => handleRegisterTournament(t.id)} 
                  style={styles.btnTour}
                >
                  <Text style={styles.btnText}>S'INSCRIRE STAKE</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.btnSec}>
            <Text style={styles.btnSecText}>Quitter</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : screen === 'play' ? (
        <View style={styles.content}>
          <View style={styles.playHeader}>
            <Text style={styles.playHeaderTitle}>🇲🇱 LE DAMIER NATIONAL 10X10</Text>
            <Text style={styles.playTurnText}>
              Tour actuel : {currentPlayer === 'white' ? 'PIONS OR (MALI)' : 'PIONS NOIRS (ROBOT/IA)'}
            </Text>
          </View>

          <View style={styles.boardGrid}>
            {board.map((row, r) => (
              <View key={r} style={styles.boardRow}>
                {row.map((piece, c) => {
                  const isPlayable = (r + c) % 2 === 1;
                  const isSelected = selectedPiece?.r === r && selectedPiece?.c === c;
                  const isLegalTarget = legalMoves.some((m) => m.to.r === r && m.to.c === c);
                  
                  return (
                    <TouchableOpacity
                      key={c}
                      activeOpacity={0.8}
                      onPress={() => isPlayable && handleSquareClick(r, c)}
                      style={[
                        styles.square,
                        { backgroundColor: isPlayable ? '#020617' : '#f5deb315' }
                      ]}
                    >
                      {isLegalTarget && (
                        <View style={styles.legalIndicator} />
                      )}

                      {piece && (
                        <View style={[
                          styles.piece,
                          piece.player === 'white' ? styles.pieceWhite : styles.pieceRed,
                          isSelected ? styles.pieceSelected : null
                        ]}>
                          <View style={piece.player === 'white' ? styles.pieceInnerWhite : styles.pieceInnerRed} />
                          {piece.isKing && (
                            <Text style={styles.kingText}>👑</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <TouchableOpacity 
            onPress={() => {
              setScreen('home');
              setSelectedPiece(null);
              setLegalMoves([]);
            }} 
            style={[styles.btnSec, { marginTop: 20 }]}
          >
            <Text style={styles.btnSecText}>🏳️ Quitter l'Arène</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 15 },
  flagSymbol: { fontSize: 45, marginBottom: 10 },
  title: { fontSize: 21, fontWeight: 'bold', color: '#fcd116', marginBottom: 5 },
  sub: { fontSize: 11, color: '#64748b', marginBottom: 25 },
  balance: { fontSize: 17, color: '#1c8b32', fontWeight: 'bold', marginVertical: 15 },
  input: { width: '90%', padding: 13, borderWidth: 1, borderColor: '#334155', borderRadius: 8, color: '#fff', backgroundColor: '#0f172a', marginBottom: 15, fontSize: 14, textAlign: 'center' },
  btnGold: { backgroundColor: '#fcd116', paddingVertical: 14, width: '90%', borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  btnSec: { paddingVertical: 10, width: '90%', alignSelf: 'center', backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnSecText: { color: '#cbd5e1', fontWeight: '600', fontSize: 12 },
  scroller: { flex: 1, padding: 20 },
  headerTitle: { fontSize: 18, color: '#fcd116', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  tourCard: { backgroundColor: '#0f172a', borderStyle: 'solid', borderWidth: 1, borderColor: '#1e293b', padding: 15, borderRadius: 10, marginBottom: 15 },
  tourName: { color: '#f8fafc', fontWeight: 'bold', fontSize: 14 },
  tourMeta: { color: '#94a3b8', fontSize: 11, marginVertical: 8 },
  btnTour: { backgroundColor: '#1c8b32', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5, alignSelf: 'flex-start' },
  subText: { color: '#475569', textAlign: 'center', marginVertical: 40, fontSize: 12 },
  
  boardGrid: { width: 330, height: 330, backgroundColor: '#0f172a', borderWidth: 4, borderColor: '#1e293b', borderRadius: 8, overflow: 'hidden', marginTop: 15 },
  boardRow: { flex: 1, flexDirection: 'row' },
  square: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  legalIndicator: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#ea580c', zIndex: 10 },
  piece: { width: '80%', height: '80%', borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  pieceWhite: { backgroundColor: '#fcd116', borderWidth: 2, borderColor: '#fff' },
  pieceRed: { backgroundColor: '#334155', borderWidth: 2, borderColor: '#475569' },
  pieceSelected: { borderColor: '#10b981', borderWidth: 3 },
  pieceInnerWhite: { width: '60%', height: '60%', borderRadius: 99, borderWidth: 1, borderColor: '#b45309' },
  pieceInnerRed: { width: '60%', height: '60%', borderRadius: 99, borderWidth: 1, borderColor: '#0f172a' },
  kingText: { position: 'absolute', fontSize: 10, color: '#fff' },
  playHeader: { padding: 5, alignItems: 'center', width: '100%' },
  playHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#f8fafc', textAlign: 'center' },
  playTurnText: { fontSize: 12, color: '#fcd116', marginTop: 4, fontWeight: 'bold', textAlign: 'center' }
});
