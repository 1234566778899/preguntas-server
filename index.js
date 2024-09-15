const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://localhost:3000', 'https://preguntas-anonimas.vercel.app'],
        credentials: true
    }
});
const port = process.env.PORT || 4000;
let salas = new Map();
io.on('connection', (socket) => {
    socket.on('enviar-nombre', (data) => {
        console.log('name: ' + socket.id);
        socket.join(data.codigo);
        socket.sala = data.codigo;
        if (salas.has(data.codigo)) {
            const sala = salas.get(data.codigo);
            const user = sala.users.find(x => x.name == data.name);
            if (sala.enJuego) socket.emit('en-juego');
            if (user) return socket.emit('nombre-repetido');
            sala.users.push({ id: socket.id, name: data.name });
        } else {
            salas.set(data.codigo, {
                users: [{ id: socket.id, name: data.name }],
                preguntas: [],
                respuestas: [],
                enJuego: false
            })
        }
        io.to(data.codigo).emit('lista-usuarios', salas.get(data.codigo).users);
    })

    socket.on('disconnect', () => {
        if (socket.sala && salas.has(socket.sala)) {
            const sala = salas.get(socket.sala);
            sala.users = sala.users.filter(user => user.id !== socket.id);
            if (sala.users.length === 0) {
                salas.delete(socket.sala);
            } else {
                io.to(socket.sala).emit('lista-usuarios', sala.users);
            }
        }
    });
    socket.on('empezar', () => {
        if (socket.sala) {
            io.to(socket.sala).emit('empezar');
            const sala = salas.get(socket.sala);
            sala.enJuego = true;
        }
    })
    socket.on('enviar-pregunta', (data) => {
        if (socket.sala) {
            const sala = salas.get(socket.sala);
            sala.preguntas.push({ id: socket.id, description: data });
            if (sala.preguntas.length != sala.users.length)
                return io.to(socket.sala).emit('cantidad-preguntas', sala.users.length - sala.preguntas.length);;
            io.to(socket.sala).emit('responder-preguntas', sala.preguntas);
        }
    })
    socket.on('enviar-respuestas', (data) => {
        if (socket.sala) {
            const sala = salas.get(socket.sala);
            sala.respuestas.push(data);
            if (sala.respuestas.length != sala.users.length)
                return io.to(socket.sala).emit('cantidad-respuestas', sala.users.length - sala.respuestas.length);;

            let resultados = [];

            for (let p of sala.preguntas) {
                let aux = {};
                aux.id = p.id;
                aux.pregunta = p.description;
                aux.respuestas = []
                for (let r of sala.respuestas) {
                    for (let key in r) {
                        if (key == p.id) {
                            aux.respuestas.push(r[key]);
                        }
                    }
                }
                resultados.push(aux);
            }
            io.to(socket.sala).emit('resultados', resultados);
        }
    })

    socket.on('reiniciar', () => {
        if (socket.sala) {
            const sala = salas.get(socket.sala);
            sala.preguntas = [];
            sala.respuestas = [];
            sala.enJuego = false;
            io.to(socket.sala).emit('reiniciar');
        }
    })
})
app.get('/', (req, res) => {
    res.send('v1.0.4');
})
server.listen(port, () => {
    console.log('server running on port:  ' + port);
});