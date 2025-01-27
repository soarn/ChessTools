import { Chess } from 'chess.js'
import { TableGames } from '~/types/supabase'

export type CleanedGame = {
    id: string,
    whitePlayer: {id: string | null, name: string, elo?: string|number},
    blackPlayer: {id: string | null, name: string, elo?: string|number},
    cleanResult: (number|string)[],
    friendlyResult: string,
}

export function cleanGame(game: TableGames, userId?: string, users?: { id: string, username: string }[]): CleanedGame {
    const chess = new Chess()
    chess.loadPgn(game.pgn)
    const pgn = chess.header()

    const white: { id: string | null, name: string } = { id: game.white_player, name: findUser(game.white_player, users) || pgn.White }
    const black: { id: string | null, name: string } = { id: game.black_player, name: findUser(game.black_player, users) || pgn.Black }

    const result = pgn.Result.includes('-') ? pgn.Result.split('-') : [-1, -1]

    const userIsWhite = userId === game.white_player && userId !== null
    const userIsBlack = userId === game.black_player && userId !== null
    let friendlyResult = 'Unknown'
    let colorIndex = -1

    if (userIsWhite) {
        colorIndex = 0
    } else if (userIsBlack) {
        colorIndex = 1
    }

    if (colorIndex > -1) {
        if (result[colorIndex] === '1') {
            friendlyResult = 'Win'
        } else if (result[colorIndex] === '0') {
            friendlyResult = 'Loss'
        } else if (result[colorIndex] === '½') {
            friendlyResult = 'Draw'
        }
    } else if (result[0] === '1') {
        friendlyResult = 'White Won'
    } else if (result[1] === '1') {
        friendlyResult = 'Black Won'
    } else if (result[0] === '½' && result[1] === '½') {
        friendlyResult = 'Draw'
    }

    return {
        id: game.id,
        whitePlayer: { ...white, elo: pgn.WhiteElo },
        blackPlayer: { ...black, elo: pgn.BlackElo },
        cleanResult: result,
        friendlyResult
    }
}

function findUser(id: string | null, users?: { id: string, username: string }[]) {
    if (id == null || users === undefined) {
        return null
    }

    return users.find(user => user.id === id)?.username || null
}
